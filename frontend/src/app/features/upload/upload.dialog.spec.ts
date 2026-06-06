import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UploadDialog } from './upload.dialog';

describe('UploadDialog', () => {
  let fixture: ComponentFixture<UploadDialog>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UploadDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(UploadDialog);
    fixture.detectChanges();
  });

  describe('backdrop click', () => {
    it('emits close when idle', () => {
      const spy = jasmine.createSpy('close');
      fixture.componentInstance.close.subscribe(spy);

      const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
      backdrop.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does NOT emit close while an upload is in flight', () => {
      const spy = jasmine.createSpy('close');
      fixture.componentInstance.close.subscribe(spy);
      fixture.componentInstance.uploading.set(true);
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
      backdrop.click();

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
