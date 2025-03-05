
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  constructor() {}

  getThemes(): Observable<string[]> {
    // Mock themes, replace with actual API call if needed
    return of(['Light', 'Dark', 'Blue', 'Green']);
  }
}