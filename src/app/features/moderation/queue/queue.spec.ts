import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { User } from '../../../core/auth/auth.types';
import { ModerationApiService } from '../data/moderation-api.service';
import { injectApproveVerificationMutation } from '../data/moderation.queries';
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

/**
 * T20 — preuve d'un refetch RÉEL après une mutation de modération, via `HttpTestingController`
 * (pas un espion sur `invalidateQueries`, voir `moderation.queries.spec.ts` T19). `ModerationApiService`
 * n'est PAS mocké ici : c'est le vrai service HTTP, wiré à un `HttpTestingController`, seule façon
 * de constater qu'un second `GET /moderation/verifications` part réellement.
 *
 * Écart assumé par rapport à un clic UI littéral : `ModerationQueue` (cet écran) ne porte
 * lui-même AUCUNE action d'approbation/rejet — ces actions vivent sur l'écran détail
 * (`moderation/detail.ts`), explicitement hors périmètre de cette tâche (un autre agent y
 * travaille en parallèle). Pour fermer ce maillon sans y toucher, ce test appelle directement la
 * mutation de production PARTAGÉE `injectApproveVerificationMutation()` (le même code que celui
 * exécuté depuis `detail.ts`, voir `moderation.queries.ts`), dans le MÊME contexte d'injection
 * (même `QueryClient`) que le composant monté — ce qui reproduit fidèlement ce qui se passe en
 * pratique quand un profil est approuvé depuis l'écran détail pendant que cette liste est
 * affichée ailleurs (ex. un autre onglet modérateur). Signalé à l'orchestrateur dans le rapport
 * de tâche : si un test au clic UI littéral est requis, il faudra étendre le périmètre à
 * `detail.spec.ts`.
 */
describe('ModerationQueue — real HTTP refetch after an approve mutation succeeds (T20)', () => {
  let fixture: ComponentFixture<ModerationQueue>;
  let httpMock: HttpTestingController;
  let queryClient: QueryClient;

  const baseUrl = `${environment.apiBaseUrl}/moderation`;

  /** Récupère (en la retirant de la file d'attente) le prochain GET réel sur la liste des demandes. */
  function expectListGet() {
    return httpMock.expectOne(
      (req) => req.method === 'GET' && req.url === `${baseUrl}/verifications`,
    );
  }

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await TestBed.configureTestingModule({
      imports: [ModerationQueue],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationQueue);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('emits a real second GET on the same list URL after an approve mutation succeeds, and the displayed content reflects the second response', async () => {
    // 1er GET réel (montage) — une demande en attente, l'utilisateur qu'on va approuver.
    const firstReq = await vi.waitFor(() => expectListGet());
    firstReq.flush(buildPage({ items: [buildRequest({ user: buildUser({ id: 'user-1' }) })] }));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('etudiant@example.com');
    });

    // Action de modération réelle (mutation de production partagée, voir commentaire ci-dessus).
    const approveMutation = TestBed.runInInjectionContext(() =>
      injectApproveVerificationMutation(),
    );
    approveMutation.mutate('user-1');

    const approveReq = await vi.waitFor(() =>
      httpMock.expectOne(
        (req) => req.method === 'POST' && req.url === `${baseUrl}/verifications/user-1/approve`,
      ),
    );
    approveReq.flush({ ...buildUser({ id: 'user-1' }), verificationStatus: 'verified' });

    // PREUVE : un second GET réel part sur la même URL de liste (pas un espion sur
    // `invalidateQueries`) — l'utilisateur approuvé, passé à `verified`, ne correspond plus au
    // filtre `pending` par défaut de cet écran : la seconde réponse le retire donc de la liste.
    const secondReq = await vi.waitFor(() => expectListGet());
    secondReq.flush(buildPage({ items: [], total: 0 }));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('etudiant@example.com');
      expect(fixture.nativeElement.textContent).toContain('Aucune demande.');
    });
  });
});
