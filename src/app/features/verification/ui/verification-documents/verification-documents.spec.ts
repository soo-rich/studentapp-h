import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { User } from '../../../../core/auth/auth.types';
import { Role } from '../../../../core/auth/role';
import { SessionService } from '../../../../core/auth/session.service';
import { VerificationApiService } from '../../data/verification-api.service';
import { VerificationDocument } from '../../data/verification.types';
import { VerificationDocuments } from './verification-documents';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    role: 'etudiant',
    verificationStatus: 'pending',
    verificationRejectionReason: null,
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

/**
 * Pose `files` sur un `<input type="file">` (propriété en lecture seule dans un vrai
 * navigateur) puis déclenche `change`, comme le ferait une sélection utilisateur réelle.
 */
function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('VerificationDocuments', () => {
  let fixture: ComponentFixture<VerificationDocuments>;
  let loader: HarnessLoader;
  let verificationApiMock: {
    list: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  async function setup(options: {
    role: Role;
    user?: User;
    documents?: VerificationDocument[];
    listResponse?: Observable<VerificationDocument[]>;
  }): Promise<void> {
    const user = options.user ?? buildUser({ role: options.role });

    verificationApiMock = {
      list: vi.fn().mockReturnValue(options.listResponse ?? of(options.documents ?? [])),
      upload: vi.fn(),
      delete: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VerificationDocuments],
      providers: [
        provideNoopAnimations(),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: VerificationApiService, useValue: verificationApiMock },
        {
          provide: SessionService,
          useValue: {
            currentUser: signal<User | null>(user),
            currentRole: signal<Role | null>(options.role),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationDocuments);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function getFileInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '#verification-document-file',
    ) as HTMLInputElement;
  }

  function getSubmitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '#verification-submit-button',
    ) as HTMLButtonElement;
  }

  async function selectDocumentType(text: string): Promise<void> {
    const select = await loader.getHarness(MatSelectHarness);
    await select.open();
    await select.clickOptions({ text });
  }

  it('creates the component', async () => {
    await setup({ role: 'etudiant' });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("shows the current user's verification badge", async () => {
    await setup({ role: 'etudiant', user: buildUser({ verificationStatus: 'pending' }) });

    expect(fixture.nativeElement.textContent).toContain('En attente de vérification');
  });

  it('offers only the étudiant document types when the current role is étudiant', async () => {
    await setup({ role: 'etudiant' });

    const select = await loader.getHarness(MatSelectHarness);
    await select.open();
    const options = await select.getOptions();
    const texts = await Promise.all(options.map((option) => option.getText()));

    expect(texts).toEqual(["Carte d'étudiant", 'Certificat de scolarité']);
  });

  it('offers only the recruteur document types when the current role is recruteur', async () => {
    await setup({ role: 'recruteur' });

    const select = await loader.getHarness(MatSelectHarness);
    await select.open();
    const options = await select.getOptions();
    const texts = await Promise.all(options.map((option) => option.getText()));

    expect(texts).toEqual(["Pièce d'identité", 'Justificatif de la structure']);
  });

  it('blocks the upload and shows a clear message when the file exceeds 5 Mo, without calling the mutation', async () => {
    await setup({ role: 'etudiant' });
    await selectDocumentType("Carte d'étudiant");

    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    setInputFiles(getFileInput(), [bigFile]);

    getSubmitButton().click();
    fixture.detectChanges();

    expect(verificationApiMock.upload).not.toHaveBeenCalled();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('5 Mo maximum');
  });

  it('requires a file before submitting, even when a type is selected', async () => {
    await setup({ role: 'etudiant' });
    await selectDocumentType("Carte d'étudiant");

    getSubmitButton().click();
    fixture.detectChanges();

    expect(verificationApiMock.upload).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Sélectionne un fichier avant d’envoyer.');
  });

  it('requires a document type before submitting, even when a file is selected', async () => {
    await setup({ role: 'etudiant' });

    const file = new File(['contenu'], 'carte.pdf', { type: 'application/pdf' });
    setInputFiles(getFileInput(), [file]);

    getSubmitButton().click();
    fixture.detectChanges();

    expect(verificationApiMock.upload).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Choisis un type de document.');
  });

  it('calls the upload mutation with the exact {type, file} payload and resets the file field on success', async () => {
    await setup({ role: 'etudiant' });
    verificationApiMock.upload.mockReturnValue(
      of(buildDocument({ id: 'doc-2', originalFilename: 'carte.pdf' })),
    );

    await selectDocumentType("Carte d'étudiant");
    const file = new File(['contenu'], 'carte.pdf', { type: 'application/pdf' });
    setInputFiles(getFileInput(), [file]);
    fixture.detectChanges();

    getSubmitButton().click();

    await vi.waitFor(() => {
      expect(verificationApiMock.upload).toHaveBeenCalledWith('carte_etudiant', file);
    });

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('carte.pdf ·');
  });

  it('shows the translated error message when the upload mutation fails', async () => {
    await setup({ role: 'etudiant' });
    const errorResponse = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        error: 'VERIFICATION_UNSUPPORTED_MEDIA_TYPE',
        message: 'Ce type de fichier n’est pas supporté.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/verification/documents',
      },
    });
    verificationApiMock.upload.mockReturnValue(throwError(() => errorResponse));

    await selectDocumentType("Carte d'étudiant");
    const file = new File(['contenu'], 'carte.txt', { type: 'text/plain' });
    setInputFiles(getFileInput(), [file]);
    fixture.detectChanges();

    getSubmitButton().click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Ce type de fichier n’est pas supporté.',
      );
    });
  });

  it('disables the submit button and the type/file inputs while the upload mutation is pending', async () => {
    await setup({ role: 'etudiant' });
    const upload$ = new Subject<VerificationDocument>();
    verificationApiMock.upload.mockReturnValue(upload$);

    await selectDocumentType("Carte d'étudiant");
    const file = new File(['contenu'], 'carte.pdf', { type: 'application/pdf' });
    setInputFiles(getFileInput(), [file]);
    fixture.detectChanges();

    getSubmitButton().click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getSubmitButton().disabled).toBe(true);
    });
    expect(getFileInput().disabled).toBe(true);

    upload$.next(buildDocument());
    upload$.complete();
  });

  it('renders the already uploaded documents with filename, type label, size and date', async () => {
    await setup({
      role: 'etudiant',
      documents: [
        buildDocument({
          id: 'doc-1',
          type: 'certificat_scolarite',
          originalFilename: 'certificat.pdf',
          sizeBytes: 1024 * 200,
          uploadedAt: '2026-07-16T00:00:00.000Z',
        }),
      ],
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('certificat.pdf');
    expect(text).toContain('Certificat de scolarité');
    expect(text).toContain('200 Ko');
    expect(text).toContain('16/07/2026');
  });

  it('shows a message when no document has been uploaded yet', async () => {
    await setup({ role: 'etudiant', documents: [] });

    expect(fixture.nativeElement.textContent).toContain("Aucun document envoyé pour l'instant.");
  });

  it('calls the delete mutation with the document id when the delete button is clicked', async () => {
    await setup({ role: 'etudiant', documents: [buildDocument({ id: 'doc-7' })] });
    verificationApiMock.delete.mockReturnValue(of(undefined));

    const deleteButton = fixture.nativeElement.querySelector(
      'button[aria-label="Supprimer carte.pdf"]',
    ) as HTMLButtonElement;
    deleteButton.click();

    expect(verificationApiMock.delete).toHaveBeenCalledWith('doc-7');
  });

  it('shows the translated error message when the delete mutation fails (e.g. 409 already verified)', async () => {
    await setup({ role: 'etudiant', documents: [buildDocument({ id: 'doc-7' })] });
    const errorResponse = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        error: 'VERIFICATION_ALREADY_VERIFIED',
        message: 'Ton profil est déjà vérifié, tu ne peux plus modifier tes documents.',
        timestamp: '2026-07-16T00:00:00.000Z',
        path: '/verification/documents/doc-7',
      },
    });
    verificationApiMock.delete.mockReturnValue(throwError(() => errorResponse));

    const deleteButton = fixture.nativeElement.querySelector(
      'button[aria-label="Supprimer carte.pdf"]',
    ) as HTMLButtonElement;
    deleteButton.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Ton profil est déjà vérifié, tu ne peux plus modifier tes documents.',
      );
    });
  });

  it('disables the delete button and shows a hint when the current user is verified', async () => {
    await setup({
      role: 'etudiant',
      user: buildUser({ verificationStatus: 'verified' }),
      documents: [buildDocument({ id: 'doc-9' })],
    });

    const deleteButton = fixture.nativeElement.querySelector(
      'button[aria-label="Supprimer carte.pdf"]',
    ) as HTMLButtonElement;

    expect(deleteButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'les documents ne peuvent plus être supprimés',
    );

    deleteButton.click();
    expect(verificationApiMock.delete).not.toHaveBeenCalled();
  });

  it('shows a loading spinner while the documents query is pending', async () => {
    await setup({ role: 'etudiant', listResponse: new Subject<VerificationDocument[]>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement des documents');
  });
});
