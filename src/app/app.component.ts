import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { ClientBridgeService, ThemeType, ClientConfig } from '@bakelor/iframe-bridge';
import { FormsModule } from '@angular/forms';

interface Seat {
  number: number;
  occupied: boolean;
}

interface Table {
  shape: string;
  size: number;
  seats: Seat[];
}

@Component({
  selector: 'app-root',
  template: `
    <div>
      <p>Config: {{ clientConfig | json }}</p>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'my-angular-project';
  clientConfig: ClientConfig = {
    appName: 'Client Application',
    version: '1.0.0',
    theme: ThemeType.LIGHT,
    language: 'en',
    trustedOrigin: 'https://next.navizard.bakelor.com',
    poweredByLabel: 'Powered by Bakelor'
  };

  shapes = ['circle', 'square'];
  selectedShape = 'circle';
  tableSize = 2;
  tables: Table[] = [];
  private unsubscribe: (() => void) | undefined;
  userProfile: any;

  constructor(private bridgeService: ClientBridgeService) {
    this.addTable();
    this.getUserProfile(); // Call the API when the component is initialized
  }

  ngOnInit() {
    this.unsubscribe = this.bridgeService.subscribeToChannel('serverTime', (data) => {
      console.log('Server time:', data.time);
      console.log('Timezone:', data.timezone);
    });
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  async getUserProfile() {
    try {
      this.userProfile = await this.bridgeService.callApi('getUserProfile', {
        userId: '123'
      });
      console.log('User profile:', this.userProfile);
    } catch (error) {
      console.error('API error:', error);
    }
  }

  addTable() {
    const seats: Seat[] = [];
    for (let i = 1; i <= this.tableSize * 4; i++) {
      seats.push({ number: i, occupied: false });
    }
    this.tables.push({ shape: this.selectedShape, size: this.tableSize, seats });
  }
}
