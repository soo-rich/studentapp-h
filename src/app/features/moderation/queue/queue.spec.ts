import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { User } from '../../../core/auth/auth.types';
import { ModerationApiService } from '../data/moderation-api.service';
import {
  ModerationQueueParams,
  VerificationDocument,
  VerificationRequest,
  VerificationRequestPage,
} from '../data/moderation.types';
import { ModerationQueue } from './queue';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'pending',
    createdAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildDocument(overrides: Partial<VerificationDocument> = {}): VerificationDocument {
  return {
    id: 'doc-1',
    type: 'carte_etudiant',
    originalFilename: 'carte.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 200,
    uploadedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildRequest(overrides: Partial<VerificationRequest> = {}): VerificationRequest {
  return {
    user: buildUser(),
    documents: [buildDocument()],
    submittedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildPage(overrides: Partial<VerificationRequestPage> = {}): VerificationRequestPage {
  return {
    items: [buildRequest()],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  };
}

describe('ModerationQueue', () => {
  let fixture: ComponentFixture<ModerationQueue>;
  let loader: HarnessLoader;
  let moderationApiMock: { listVerifications: ReturnType<typeof vi.fn> };

  async function setup(options: {
    listResponse?: Observable<VerificationRequestPage>;
    listImplementation?: (params: ModerationQueueParams) => Observable<VerificationRequestPage>;
  } = {}): Promise<void> {
    moderationApiMock = {
      listVerifications:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
    };

    await TestBed.configureTestingModule({
      imports: [ModerationQueue],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ModerationApiService, useValue: moderationApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationQueue);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the queue with the default pending filter and page 1 on load', async () => {
    await setup();

    expect(moderationApiMock.listVerifications).toHaveBeenCalledWith({
      status: 'pending',
      page: 1,
      pageSize: 20,
    });
  });

  it('shows a loading spinner while the queue query is pending', async () => {
    await setup({ listResponse: new Subject<VerificationRequestPage>() });

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

  it('shows a message when there is no request matching the filter', async () => {
    await setup({ listResponse: of(buildPage({ items: [], total: 0 })) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Aucune demande.');
    });
  });

  it('renders each request with email, role, document count and formatted submission date', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildRequest({
              user: buildUser({ email: 'recruteur@example.com', role: 'recruteur' }),
              documents: [buildDocument(), buildDocument({ id: 'doc-2' })],
              submittedAt: '2026-07-16T00:00:00.000Z',
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('recruteur@example.com');
      expect(text).toContain('Recruteur');
      expect(text).toContain('2 document(s)');
      expect(text).toContain('16/07/2026');
    });
  });

  it('links each request row to its detail route via an absolute routerLink', async () => {
    await setup({
      listResponse: of(buildPage({ items: [buildRequest({ user: buildUser({ id: 'user-42' }) })] })),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/moderation/user-42');
    });
  });

  it('re-requests the queue with the selected status and resets to page 1 when the filter changes', async () => {
    await setup();
    await vi.waitFor(() => {
      expect(moderationApiMock.listVerifications).toHaveBeenCalledWith({
        status: 'pending',
        page: 1,
        pageSize: 20,
      });
    });

    const group = await loader.getHarness(MatButtonToggleGroupHarness);
    const toggles = await group.getToggles({ text: 'Vérifiés' });
    await toggles[0].check();

    await vi.waitFor(() => {
      expect(moderationApiMock.listVerifications).toHaveBeenCalledWith({
        status: 'verified',
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
      expect(moderationApiMock.listVerifications).toHaveBeenCalledWith({
        status: 'pending',
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
