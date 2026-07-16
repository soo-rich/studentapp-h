import { TestBed } from '@angular/core/testing';

import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  it('defaults currentRole to null (visiteur non connecté)', () => {
    expect(service.currentRole()).toBeNull();
  });

  it('updates currentRole when setRole is called', () => {
    service.setRole('etudiant');
    expect(service.currentRole()).toBe('etudiant');
  });

  it('resets currentRole to null when setRole(null) is called', () => {
    service.setRole('recruteur');
    service.setRole(null);
    expect(service.currentRole()).toBeNull();
  });
});
