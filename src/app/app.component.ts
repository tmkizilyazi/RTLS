import { Component, OnInit, OnDestroy } from '@angular/core';
import { ClientBridgeService, ThemeType, ClientConfig, ScriptInfo } from '@bakelor/iframe-bridge/dist';

interface Seat {
  number: number;
  occupied: boolean;
  position: { x: number, y: number };
  rotation: number;
}

interface Table {
  shape: string;
  size: number;
  seats: Seat[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'my-angular-project';
  clientConfig: ClientConfig = {
    appId: 'client-app-id',
    appName: 'Client Application',
    version: '1.0.0',
    theme: ThemeType.LIGHT,
    language: 'en',
    metaTags: [],
    script: { src: '', async: true, name: '', version: '', framework: { name: "Angular", version: '' } } as ScriptInfo,
    timestamp: Date.now(),
    trustedOrigin: 'https://next.navizard.bakelor.com',
    poweredByLabel: 'Powered by Bakelor'
  };

  shapes = ['circle', 'square'];
  selectedShape: string | null = null;
  tableSize = 2;
  tables: Table[] = [];
  tableWidth = 800;
  tableLength = 600;
  seats: Seat[] = [];
  draggedSeat: Seat | null = null;
  lastMouseX = 0;
  lastMouseY = 0;
  isSidebarOpen: boolean = true;
  is3D = false;

  constructor(private bridgeService: ClientBridgeService) {
    this.getUserProfile();
  }

  ngOnInit() {
    this.bridgeService.subscribeToChannel('serverTime', (data) => {
      console.log('Server time:', data.time);
      console.log('Timezone:', data.timezone);
    });
    this.bridgeService.subscribeToChannel('dataChannel', (data) => {
      console.log('IFrame\'den gelen veri: ', data);
      this.logIframeData(data);
    });
    this.initializeSeats([]);
  }

  ngOnDestroy() {
    this.bridgeService.unsubscribeFromChannel('serverTime');
    this.bridgeService.unsubscribeFromChannel('dataChannel');
  }

  async getUserProfile() {
    try {
      const userProfile = await this.bridgeService.callApi('getUserProfile', {
        userId: '123'
      });
      console.log('User profile:', userProfile);
    } catch (error) {
      console.error('API error:', error);
    }
  }

  addTable() {
    const seats: Seat[] = [];
    for (let i = 1; i <= 4; i++) {
      seats.push({ number: i, occupied: false, position: { x: 0, y: 0 }, rotation: 0 });
    }
    this.seats = seats;
  }

  selectShape(shape: string) {
    this.selectedShape = shape;
    this.initializeSeats([]);
  }

  initializeSeats(defaultSeats: Seat[]) {
    this.seats = defaultSeats.map(seat => ({
      ...seat,
      position: { x: 0, y: 0 },
      rotation: 0
    }));
  }

  addSeat() {
    const newId = Math.max(0, ...this.seats.map(s => s.number)) + 1;
    const newSeat: Seat = {
      number: newId,
      occupied: false,
      position: { x: Math.min(200, this.tableWidth - 80), y: Math.min(200, this.tableLength - 80) },
      rotation: 0
    };
    this.seats = [...this.seats, newSeat];
  }

  updateTable() {
    this.seats = this.seats.map(seat => ({
      ...seat,
      position: {
        x: Math.min(Math.max(0, seat.position.x), this.tableWidth - 80),
        y: Math.min(Math.max(0, seat.position.y), this.tableLength - 80)
      }
    }));
  }

  startDrag(event: MouseEvent, seat: Seat) {
    if (event.button === 0) {
      event.preventDefault();
      this.draggedSeat = seat;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  onMouseMove(e: MouseEvent) {
    if (this.draggedSeat) {
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;
      if (this.draggedSeat && this.draggedSeat.position) {
        const newX = this.draggedSeat.position.x + deltaX;
        const newY = this.draggedSeat.position.y + deltaY;
        this.draggedSeat.position = { x: newX, y: newY };
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  }

  onMouseUp() {
    if (this.draggedSeat) {
      this.draggedSeat = null;
    }
  }

  rotateSeat(event: MouseEvent, seat: Seat) {
    event.preventDefault();
    seat.rotation = (seat.rotation + 90) % 360;
  }

  deleteSeat(seat: Seat, event: MouseEvent) {
    event.stopPropagation();
    this.seats = this.seats.filter(s => s.number !== seat.number);
  }

  getSeatTransform(seat: Seat): string {
    return `translate(${seat.position.x}px, ${seat.position.y}px) rotate(${seat.rotation}deg)`;
  }

  getActiveSeats(): number {
    return this.seats.filter(seat => seat.occupied).length;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggle3DView() {
    this.is3D = !this.is3D;
  }

  getTableStyles(): { [key: string]: any } {
    let styles: { [key: string]: any } = {
      'background': "url('/images/wood-texture.jpg') no-repeat center center",
      'backgroundSize': 'cover',
      'backgroundPosition': 'center',
      'transition': 'all 0.3s'
    };
    if (this.selectedShape === 'circle') {
      styles['border-radius'] = '50%';
    } else {
      styles['border-radius'] = '10px';
    }
    return styles;
  }

  logIframeData(data: any) {
    console.log('Iframe Data:', data);
  }
}
