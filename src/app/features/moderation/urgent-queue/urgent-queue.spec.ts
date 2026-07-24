import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { User } from '../../../core/auth/auth.types';
import { ModerationApiService } from '../data/moderation-api.service';
import {
  ModerationUrgentRequest,
  ModerationUrgentRequestPage,
  UrgentQueueParams,
  UrgentRequestReviewRequest,
} from '../data/moderation.types';
import { UrgentQueue } from './urgent-queue';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'etudiant@example.com',
    role: 'etudiant',
    verificationStatus: 'verified',
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

function buildUrgentRequest(overrides: Partial<ModerationUrgentRequest> = {}): ModerationUrgentRequest {
  return {
    id: 'urgent-1',
    status: 'pending',
    message: 'Je traverse une période difficile en ce moment.',
    moderatorNote: null,
    user: buildUser(),
    createdAt: '2026-07-10T00:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

function buildPage(
  overrides: Partial<ModerationUrgentRequestPage> = {},
): ModerationUrgentRequestPage {
  return {
    items: [buildUrgentRequest()],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  };
}

const CONFLICT_ERROR = new HttpErrorResponse({
  status: 409,
  error: {
    statusCode: 409,
    error: 'URGENT_REQUEST_INVALID_STATE',
    message: 'Cette demande de vérification est dans un état invalide.',
    timestamp: '2026-07-16T00:00:00.000Z',
    path: '/moderation/urgent-requests/urgent-1/review',
  },
});

describe('UrgentQueue', () => {
  let fixture: ComponentFixture<UrgentQueue>;
  let loader: HarnessLoader;
  let moderationApiMock: {
    listUrgentRequests: ReturnType<typeof vi.fn>;
    reviewUrgentRequest: ReturnType<typeof vi.fn>;
  };

  async function setup(
    options: {
      listResponse?: Observable<ModerationUrgentRequestPage>;
      listImplementation?: (params: UrgentQueueParams) => Observable<ModerationUrgentRequestPage>;
      reviewResponse?: Observable<ModerationUrgentRequest>;
    } = {},
  ): Promise<void> {
    moderationApiMock = {
      listUrgentRequests:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
      reviewUrgentRequest: vi
        .fn()
        .mockReturnValue(options.reviewResponse ?? of(buildUrgentRequest({ status: 'prioritized' }))),
    };

    await TestBed.configureTestingModule({
      imports: [UrgentQueue],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: ModerationApiService, useValue: moderationApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UrgentQueue);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  async function waitForItemsRendered(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Je traverse une période difficile');
    });
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the queue with the default pending filter and page 1 on load', async () => {
    await setup();

    expect(moderationApiMock.listUrgentRequests).toHaveBeenCalledWith({
      status: 'pending',
      page: 1,
      pageSize: 20,
    });
  });

  it('shows a loading spinner while the queue query is pending', async () => {
    await setup({ listResponse: new Subject<ModerationUrgentRequestPage>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de la file');
  });

  it('shows a generic error message when the queue query fails', async () => {
    await setup({ listResponse: throwError(() => new Error('network down')) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = query('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain('Une erreur est survenue');
    });
  });

  it('shows a neutral message (not an error) when there is no request matching the filter', async () => {
    await setup({ listResponse: of(buildPage({ items: [], total: 0 })) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Aucune demande pour ce filtre.');
      expect(query('[role="alert"]')).toBeNull();
    });
  });

  it('renders each request with message, author email/role, submission date and status', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildUrgentRequest({
              message: 'Je traverse une période difficile en ce moment.',
              user: buildUser({ email: 'recruteur@example.com', role: 'recruteur' }),
              createdAt: '2026-07-10T00:00:00.000Z',
              status: 'pending',
            }),
          ],
        }),
      ),
    });

    await waitForItemsRendered();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('recruteur@example.com');
    expect(text).toContain('Recruteur');
    expect(text).toContain('10/07/2026');
    expect(text).toContain('En attente');
  });

  it('shows the moderator note and hides treatment actions for a request that was already handled', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildUrgentRequest({
              id: 'urgent-9',
              status: 'prioritized',
              moderatorNote: 'Suivi effectué par téléphone.',
              reviewedAt: '2026-07-12T00:00:00.000Z',
            }),
          ],
        }),
      ),
    });

    await waitForItemsRendered();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Suivi effectué par téléphone.');
    expect(text).toContain('12/07/2026');
    // Preuve non tautologique (voir brief T15) : casser `item.status === 'pending'` en un
    // toujours-vrai dans `urgent-queue.html` fait réapparaître ces boutons pour cette demande
    // déjà traitée, ce qui fait rougir les deux assertions ci-dessous.
    expect(query('#prioritize-button-urgent-9')).toBeNull();
    expect(query('#dismiss-button-urgent-9')).toBeNull();
  });

  it('re-requests the queue with the selected status and resets to page 1 when the filter changes', async () => {
    await setup();
    await vi.waitFor(() => {
      expect(moderationApiMock.listUrgentRequests).toHaveBeenCalledWith({
        status: 'pending',
        page: 1,
        pageSize: 20,
      });
    });

    const group = await loader.getHarness(MatButtonToggleGroupHarness);
    const toggles = await group.getToggles({ text: 'Priorisées' });
    await toggles[0].check();

    await vi.waitFor(() => {
      expect(moderationApiMock.listUrgentRequests).toHaveBeenCalledWith({
        status: 'prioritized',
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
      return query<HTMLButtonElement>('#previous-page-button')!;
    }

    function getNextButton(): HTMLButtonElement {
      return query<HTMLButtonElement>('#next-page-button')!;
    }

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(true);
      expect(getNextButton().disabled).toBe(false);
    });

    getNextButton().click();

    await vi.waitFor(() => {
      expect(moderationApiMock.listUrgentRequests).toHaveBeenCalledWith({
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

  it('opens the confirmation panel and hides the action buttons when "Prioriser" is clicked', async () => {
    await setup();
    await waitForItemsRendered();

    query<HTMLButtonElement>('#prioritize-button-urgent-1')!.click();
    fixture.detectChanges();

    expect(query('#confirm-action-button')).not.toBeNull();
    expect(query('#prioritize-button-urgent-1')).toBeNull();
    expect(query('#dismiss-button-urgent-1')).toBeNull();
  });

  it('cancels the confirmation panel without calling the mutation', async () => {
    await setup();
    await waitForItemsRendered();

    query<HTMLButtonElement>('#dismiss-button-urgent-1')!.click();
    fixture.detectChanges();
    expect(query('#confirm-action-button')).not.toBeNull();

    query<HTMLButtonElement>('#cancel-action-button')!.click();
    fixture.detectChanges();

    expect(query('#confirm-action-button')).toBeNull();
    expect(moderationApiMock.reviewUrgentRequest).not.toHaveBeenCalled();
  });

  it('confirms the "prioritize" decision with the exact payload {decision} when no note is entered', async () => {
    await setup();
    await waitForItemsRendered();

    query<HTMLButtonElement>('#prioritize-button-urgent-1')!.click();
    fixture.detectChanges();

    query<HTMLButtonElement>('#confirm-action-button')!.click();

    await vi.waitFor(() => {
      expect(moderationApiMock.reviewUrgentRequest).toHaveBeenCalledWith('urgent-1', {
        decision: 'prioritize',
      } satisfies UrgentRequestReviewRequest);
    });
  });

  it('confirms the "dismiss" decision with the exact payload {decision, note} when a note is entered', async () => {
    await setup();
    await waitForItemsRendered();

    query<HTMLButtonElement>('#dismiss-button-urgent-1')!.click();
    fixture.detectChanges();

    const textarea = query<HTMLTextAreaElement>('textarea')!;
    textarea.value = 'Suivi terrain effectué.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>('#confirm-action-button')!.click();

    // Preuve non tautologique (voir brief T15) : élargir le payload construit dans
    // `onConfirmAction` (ex. ajouter un champ `reviewedBy` en plus de `decision`/`note`) fait
    // rougir cette assertion — `toHaveBeenCalledWith` compare l'objet dans son intégralité.
    await vi.waitFor(() => {
      expect(moderationApiMock.reviewUrgentRequest).toHaveBeenCalledWith('urgent-1', {
        decision: 'dismiss',
        note: 'Suivi terrain effectué.',
      } satisfies UrgentRequestReviewRequest);
    });
  });

  it('disables the confirm and cancel buttons while the review mutation is pending', async () => {
    const reviewSubject = new Subject<ModerationUrgentRequest>();
    await setup({ reviewResponse: reviewSubject });
    await waitForItemsRendered();

    query<HTMLButtonElement>('#prioritize-button-urgent-1')!.click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#confirm-action-button')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query<HTMLButtonElement>('#confirm-action-button')!.disabled).toBe(true);
      expect(query<HTMLButtonElement>('#cancel-action-button')!.disabled).toBe(true);
    });

    reviewSubject.complete();
  });

  it('shows a sober conflict message and refreshes the list on a 409 URGENT_REQUEST_INVALID_STATE', async () => {
    await setup({ reviewResponse: throwError(() => CONFLICT_ERROR) });
    await waitForItemsRendered();

    expect(moderationApiMock.listUrgentRequests).toHaveBeenCalledTimes(1);

    query<HTMLButtonElement>('#prioritize-button-urgent-1')!.click();
    fixture.detectChanges();
    query<HTMLButtonElement>('#confirm-action-button')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = query('[role="alert"]');
      expect(alert?.textContent).toContain('déjà été traitée par un autre membre de la modération');
    });

    await vi.waitFor(() => {
      expect(moderationApiMock.listUrgentRequests).toHaveBeenCalledTimes(2);
    });

    fixture.detectChanges();
    expect(query('#confirm-action-button')).toBeNull();
  });
});
