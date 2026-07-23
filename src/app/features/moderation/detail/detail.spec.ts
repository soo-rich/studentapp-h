import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { User } from '../../../core/auth/auth.types';
import { ModerationApiService } from '../data/moderation-api.service';
import { VerificationDocument, VerificationRequest } from '../data/moderation.types';
import { ModerationDetail } from './detail';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'pending',
    verificationRejectionReason: null,
    createdAt: '2026-01-10T00:00:00.000Z',
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

describe('ModerationDetail', () => {
  let fixture: ComponentFixture<ModerationDetail>;
  let moderationApiMock: {
    listVerifications: ReturnType<typeof vi.fn>;
    getVerification: ReturnType<typeof vi.fn>;
    downloadDocument: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      userId?: string;
      request?: VerificationRequest;
      detailResponse?: Observable<VerificationRequest>;
      downloadResponse?: Observable<Blob>;
    } = {},
  ): Promise<void> {
    const userId = options.userId ?? 'user-1';

    moderationApiMock = {
      listVerifications: vi.fn(),
      getVerification: vi
        .fn()
        .mockReturnValue(
          options.detailResponse ??
            of(options.request ?? buildRequest({ user: buildUser({ id: userId }) })),
        ),
      downloadDocument: vi.fn().mockReturnValue(options.downloadResponse ?? of(new Blob())),
      approve: vi.fn(),
      reject: vi.fn(),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ModerationDetail],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ModerationApiService, useValue: moderationApiMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ userId })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationDetail);
    fixture.detectChanges();
  }

  afterEach(() => {
    // `downloads a document...` mocke `HTMLAnchorElement.prototype.click`/`URL.create|revokeObjectURL`
    // (globaux, partagés avec les autres fichiers de spec) : restauration systématique pour ne
    // jamais laisser fuiter un mock au-delà du test qui l'a posé.
    vi.restoreAllMocks();
  });

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  /**
   * Attend que `detailQuery` ait résolu (avec succès) et que le contenu dépendant des
   * données (identité, documents, actions) soit rendu — la requête resout de façon
   * asynchrone (TanStack Query), un simple `detectChanges()` juste après `setup()` ne suffit
   * pas à la garantir déjà résolue.
   */
  async function waitForRequestLoaded(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('#approve-button')).not.toBeNull();
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the detail with the userId read from the route', async () => {
    await setup({ userId: 'user-77' });

    await vi.waitFor(() => {
      expect(moderationApiMock.getVerification).toHaveBeenCalledWith('user-77');
    });
  });

  it('shows a loading spinner while the detail query is pending', async () => {
    await setup({ detailResponse: new Subject<VerificationRequest>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de la demande');
  });

  it("shows the backend's translated message when the detail query fails (e.g. 404 not found)", async () => {
    const errorResponse = new HttpErrorResponse({
      status: 404,
      error: {
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'Cette demande de vérification est introuvable.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/moderation/verifications/user-404',
      },
    });

    await setup({ detailResponse: throwError(() => errorResponse) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Cette demande de vérification est introuvable.',
      );
    });
  });

  it('renders identity, submission date and documents', async () => {
    await setup({
      request: buildRequest({
        user: buildUser({
          id: 'user-1',
          email: 'etu@example.com',
          role: 'etudiant',
          createdAt: '2026-01-10T00:00:00.000Z',
        }),
        documents: [
          buildDocument({
            originalFilename: 'carte.pdf',
            sizeBytes: 1024 * 200,
            type: 'carte_etudiant',
          }),
        ],
        submittedAt: '2026-07-16T00:00:00.000Z',
      }),
    });
    await waitForRequestLoaded();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('etu@example.com');
    expect(text).toContain('Étudiant');
    expect(text).toContain('carte.pdf');
    expect(text).toContain('200 Ko');
    expect(text).toContain('16/07/2026');
    expect(text).toContain('10/01/2026');
  });

  it('shows the rejection reason when the request was rejected', async () => {
    await setup({
      request: buildRequest({
        user: buildUser({
          verificationStatus: 'rejected',
          verificationRejectionReason: 'Document illisible',
        }),
      }),
    });
    await waitForRequestLoaded();

    expect(fixture.nativeElement.textContent).toContain('Document illisible');
  });

  it('approves the request with the current userId and navigates to /moderation on success', async () => {
    await setup({ userId: 'user-5', request: buildRequest({ user: buildUser({ id: 'user-5' }) }) });
    await waitForRequestLoaded();
    moderationApiMock.approve.mockReturnValue(of(buildUser({ id: 'user-5', verificationStatus: 'verified' })));

    query<HTMLButtonElement>('#approve-button').click();

    await vi.waitFor(() => {
      expect(moderationApiMock.approve).toHaveBeenCalledWith('user-5');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/moderation']);
    });
  });

  it('disables approve and reject actions once the request is already verified', async () => {
    await setup({
      request: buildRequest({ user: buildUser({ verificationStatus: 'verified' }) }),
    });
    await waitForRequestLoaded();

    expect(query<HTMLButtonElement>('#approve-button').disabled).toBe(true);
    expect(query<HTMLButtonElement>('#show-reject-button').disabled).toBe(true);
  });

  it('blocks the rejection and shows a validation message when the reason is shorter than 3 characters, without calling the mutation', async () => {
    await setup({ request: buildRequest({ user: buildUser({ id: 'user-5' }) }) });
    await waitForRequestLoaded();

    query<HTMLButtonElement>('#show-reject-button').click();
    fixture.detectChanges();

    const textarea = query<HTMLTextAreaElement>('textarea');
    textarea.value = 'ab';
    textarea.dispatchEvent(new Event('input'));

    query<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    // `mutate()` (TanStack Query) dispatche `mutationFn` de façon asynchrone (micro/macrotask) :
    // sans ce flush, l'assertion négative ci-dessous serait vraie AVANT même que le garde-fou
    // ait eu la chance d'être contourné, rendant le test tautologique (il resterait vert même si
    // le garde-fou de `onSubmitReject` disparaissait). On laisse explicitement s'écouler un tick
    // macrotask pour donner sa chance à un appel non désiré de se produire avant d'asserter.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(moderationApiMock.reject).not.toHaveBeenCalled();
    // Assertion structurelle en complément (contraste avec le cas valide) : le formulaire est
    // toujours affiché et invalide — preuve que c'est bien le garde-fou de validation qui a
    // bloqué la soumission, pas un simple retard d'exécution.
    expect(query('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Le motif doit contenir au moins 3 caractères.',
    );
  });

  it('rejects the request with {userId, reason} and navigates to /moderation on success when the reason is valid', async () => {
    await setup({ userId: 'user-5', request: buildRequest({ user: buildUser({ id: 'user-5' }) }) });
    await waitForRequestLoaded();
    moderationApiMock.reject.mockReturnValue(of(buildUser({ id: 'user-5', verificationStatus: 'rejected' })));

    query<HTMLButtonElement>('#show-reject-button').click();
    fixture.detectChanges();

    const textarea = query<HTMLTextAreaElement>('textarea');
    textarea.value = 'Document illisible';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>('#confirm-reject-button').click();

    await vi.waitFor(() => {
      expect(moderationApiMock.reject).toHaveBeenCalledWith('user-5', 'Document illisible');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/moderation']);
    });
  });

  it('cancels the reject form without calling the mutation', async () => {
    await setup({ request: buildRequest({ user: buildUser({ id: 'user-5' }) }) });
    await waitForRequestLoaded();

    query<HTMLButtonElement>('#show-reject-button').click();
    fixture.detectChanges();
    expect(query('form')).not.toBeNull();

    query<HTMLButtonElement>('#cancel-reject-button').click();
    fixture.detectChanges();

    expect(query('form')).toBeNull();
    expect(moderationApiMock.reject).not.toHaveBeenCalled();
  });

  it('downloads a document by calling downloadDocument and revokes the created object URL', async () => {
    const blob = new Blob(['contenu'], { type: 'application/pdf' });
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await setup({
      request: buildRequest({ documents: [buildDocument({ id: 'doc-9', originalFilename: 'carte.pdf' })] }),
      downloadResponse: of(blob),
    });
    await waitForRequestLoaded();

    query<HTMLButtonElement>('button[aria-label="Télécharger carte.pdf"]').click();

    await vi.waitFor(() => {
      expect(moderationApiMock.downloadDocument).toHaveBeenCalledWith('doc-9');
    });
    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it("shows the backend's translated message when a document download fails", async () => {
    const errorResponse = new HttpErrorResponse({
      status: 500,
      error: {
        statusCode: 500,
        error: 'INTERNAL_ERROR',
        message: 'Le téléchargement a échoué.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/moderation/documents/doc-9/content',
      },
    });
    await setup({
      request: buildRequest({ documents: [buildDocument({ id: 'doc-9', originalFilename: 'carte.pdf' })] }),
      downloadResponse: throwError(() => errorResponse),
    });
    await waitForRequestLoaded();

    query<HTMLButtonElement>('button[aria-label="Télécharger carte.pdf"]').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Le téléchargement a échoué.');
    });
  });
});
