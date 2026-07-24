import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ModerationApplicationsApiService } from '../data/moderation-applications-api.service';
import {
  ModerationApplication,
  ModerationApplicationPage,
  ModerationApplicationsQueueParams,
  OfferSummary,
  StudentProfile,
} from '../data/moderation-applications.types';
import { ModerationApplicationsQueue } from './applications-queue';

function buildOffer(overrides: Partial<OfferSummary> = {}): OfferSummary {
  return {
    id: 'offer-1',
    title: 'Vendeur week-end',
    opportunityType: 'temps_partiel',
    structureName: 'Boutique ABC',
    ...overrides,
  };
}

function buildStudent(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    userId: 'user-1',
    firstName: 'Awa',
    lastName: 'Koffi',
    university: 'Université de Lomé',
    studentCardNumber: 'UL-2026-001',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: [],
    languages: [],
    residenceLocation: 'Lomé',
    opportunityTypes: ['temps_partiel'],
    availabilitySlots: [],
    sensitiveDataConsent: false,
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildApplication(overrides: Partial<ModerationApplication> = {}): ModerationApplication {
  return {
    id: 'application-1',
    offer: buildOffer(),
    student: buildStudent(),
    status: 'pending_moderation',
    message: null,
    rejectionReason: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildPage(overrides: Partial<ModerationApplicationPage> = {}): ModerationApplicationPage {
  return {
    items: [buildApplication()],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  };
}

describe('ModerationApplicationsQueue', () => {
  let fixture: ComponentFixture<ModerationApplicationsQueue>;
  let loader: HarnessLoader;
  let apiMock: { list: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      listResponse?: Observable<ModerationApplicationPage>;
      listImplementation?: (
        params: ModerationApplicationsQueueParams,
      ) => Observable<ModerationApplicationPage>;
    } = {},
  ): Promise<void> {
    apiMock = {
      list:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
    };

    await TestBed.configureTestingModule({
      imports: [ModerationApplicationsQueue],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ModerationApplicationsApiService, useValue: apiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationApplicationsQueue);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the queue with the default pending_moderation filter and page 1 on load', async () => {
    await setup();

    expect(apiMock.list).toHaveBeenCalledWith({
      status: 'pending_moderation',
      page: 1,
      pageSize: 20,
    });
  });

  it('shows a loading spinner while the queue query is pending', async () => {
    await setup({ listResponse: new Subject<ModerationApplicationPage>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de la file');
  });

  it('shows a generic error message when the queue query fails', async () => {
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
      expect(fixture.nativeElement.textContent).toContain('Aucune candidature.');
    });
  });

  it('renders each application with offer title, structure, student name/university, status and date', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildApplication({
              offer: buildOffer({ title: 'Caissier', structureName: 'Supermarché XYZ' }),
              student: buildStudent({
                firstName: 'Koffi',
                lastName: 'Mensah',
                university: 'Université de Kara',
              }),
              status: 'forwarded',
              createdAt: '2026-07-16T00:00:00.000Z',
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Caissier');
      expect(text).toContain('Supermarché XYZ');
      expect(text).toContain('Koffi Mensah');
      expect(text).toContain('Université de Kara');
      expect(text).toContain('Transmise au recruteur');
      expect(text).toContain('16/07/2026');
    });
  });

  it('links each application row to its detail route via an absolute routerLink', async () => {
    await setup({
      listResponse: of(buildPage({ items: [buildApplication({ id: 'application-42' })] })),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/moderation/candidatures/application-42');
    });
  });

  it('re-requests the queue with the selected status and resets to page 1 when the filter changes', async () => {
    await setup();
    await vi.waitFor(() => {
      expect(apiMock.list).toHaveBeenCalledWith({
        status: 'pending_moderation',
        page: 1,
        pageSize: 20,
      });
    });

    const group = await loader.getHarness(MatButtonToggleGroupHarness);
    const toggles = await group.getToggles({ text: 'Transmises' });
    await toggles[0].check();

    await vi.waitFor(() => {
      expect(apiMock.list).toHaveBeenCalledWith({
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

    function getPreviousButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('#previous-page-button') as HTMLButtonElement;
    }

    function getNextButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('#next-page-button') as HTMLButtonElement;
    }

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(true);
      expect(getNextButton().disabled).toBe(false);
    });

    getNextButton().click();

    await vi.waitFor(() => {
      expect(apiMock.list).toHaveBeenCalledWith({
        status: 'pending_moderation',
        page: 2,
        pageSize: 20,
      });
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(false);
      expect(getNextButton().disabled).toBe(true);
    });
  });
});
