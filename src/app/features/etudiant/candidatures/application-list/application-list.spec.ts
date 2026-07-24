import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ApplicationsApiService } from '../../data/applications-api.service';
import {
  StudentApplication,
  StudentApplicationListParams,
  StudentApplicationPage,
} from '../../data/applications.types';
import { ApplicationList } from './application-list';

function buildApplication(overrides: Partial<StudentApplication> = {}): StudentApplication {
  return {
    id: 'app-1',
    offer: {
      id: 'offer-1',
      title: 'Serveur en salle',
      opportunityType: 'job_vacances',
      structureName: 'Le Bon Coin Resto',
    },
    status: 'pending_moderation',
    message: null,
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildPage(overrides: Partial<StudentApplicationPage> = {}): StudentApplicationPage {
  return {
    items: [buildApplication()],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  };
}

describe('ApplicationList', () => {
  let fixture: ComponentFixture<ApplicationList>;
  let loader: HarnessLoader;
  let applicationsApiMock: { listApplications: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      listResponse?: Observable<StudentApplicationPage>;
      listImplementation?: (
        params: StudentApplicationListParams,
      ) => Observable<StudentApplicationPage>;
    } = {},
  ): Promise<void> {
    applicationsApiMock = {
      listApplications:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationList],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ApplicationsApiService, useValue: applicationsApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationList);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function getPreviousButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#previous-page-button') as HTMLButtonElement;
  }

  function getNextButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#next-page-button') as HTMLButtonElement;
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the applications with no status filter and page 1 on load', async () => {
    await setup();

    expect(applicationsApiMock.listApplications).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it('shows a loading spinner while the applications query is pending', async () => {
    await setup({ listResponse: new Subject<StudentApplicationPage>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de tes candidatures');
  });

  it('shows a generic error message when the applications query fails', async () => {
    await setup({ listResponse: throwError(() => new Error('network down')) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain('Une erreur est survenue');
    });
  });

  it('shows a message when there is no application matching the filter', async () => {
    await setup({ listResponse: of(buildPage({ items: [], total: 0 })) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Aucune candidature pour ce filtre.');
    });
  });

  it('renders each application with offer title, structure name, status badge, and links to its detail route', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildApplication({
              id: 'app-42',
              offer: {
                id: 'offer-1',
                title: 'Serveur en salle',
                opportunityType: 'job_vacances',
                structureName: 'Le Bon Coin Resto',
              },
              status: 'forwarded',
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Serveur en salle');
      expect(text).toContain('Le Bon Coin Resto');
      expect(text).toContain('Transmise au recruteur');

      const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/etudiant/candidatures/app-42');
    });
  });

  it('shows the rejection reason only when the status is rejected_moderation', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildApplication({
              status: 'rejected_moderation',
              rejectionReason: 'Profil incomplet',
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Profil incomplet');
    });
  });

  it('does not show a rejection reason for a non rejected_moderation application, even if one is present', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [buildApplication({ status: 'forwarded', rejectionReason: 'Profil incomplet' })],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Profil incomplet');
    });
  });

  it('re-requests the applications with the selected status and resets to page 1 when the filter changes', async () => {
    await setup();
    await vi.waitFor(() => {
      expect(applicationsApiMock.listApplications).toHaveBeenCalledWith({
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    const select = await loader.getHarness(MatSelectHarness);
    await select.open();
    await select.clickOptions({ text: 'Transmise au recruteur' });

    await vi.waitFor(() => {
      expect(applicationsApiMock.listApplications).toHaveBeenCalledWith({
        status: 'forwarded',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('disables the previous button on the first page and enables it after moving to the next page', async () => {
    await setup({
      listImplementation: (params) =>
        of(buildPage({ page: params.page ?? 1, pageSize: 20, total: 25 })),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(true);
      expect(getNextButton().disabled).toBe(false);
    });

    getNextButton().click();

    await vi.waitFor(() => {
      expect(applicationsApiMock.listApplications).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(false);
      expect(getNextButton().disabled).toBe(true);
    });
  });
});
