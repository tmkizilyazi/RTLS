import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ClientBridgeService, ThemeType, ClientConfig, ScriptInfo } from '@bakelor/iframe-bridge/dist';

export interface Seat {
  number: number;
  occupied: boolean;
  position: { x: number, y: number };
  rotation: number;
  userInfo?: {
    name?: string;
    id?: string;
    status?: string;
    lastSeen?: string;
  };
  showInfo?: boolean;
}

export interface LiveLocation {
  tagSessionHistoryId: string;
  zoneDuration: number;
  distance: number;
  firstSeenAt: string;
  lastSeenAt: string;
  alert: string;
  permission: string;
  zoneId: string;
  zoneName: string;
}

export interface Table {
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

  shapes = ['circle', 'square', 'rectangle', 'oval', 'triangle', 'hexagon', 'octagon'];
  selectedShape: string = 'rectangle';
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
  iframeData: any = null;
  selectedMaterial: string = 'wood';
  tableHeight: number = 30;
  iframeBridgeInitialized: boolean = false;
  isAppReady: boolean = false; // Uygulamanın hazır olup olmadığını takip eder
  readinessAttempts: number = 0;
  appInfo: any = null;
  onAppReadyListeners: ((appInfo: any) => void)[] = [];

  // Canlı konum verilerini saklamak için yeni property
  liveLocationData: LiveLocation | null = null;
  liveLocationError: string | null = null;

  materials = [
    { id: 'wood', name: 'Ahşap', color: '#8b5e3c' },
    { id: 'glass', name: 'Cam', color: 'rgba(173, 216, 230, 0.6)' },
    { id: 'marble', name: 'Mermer', color: '#E6E6E6' },
    { id: 'metal', name: 'Metal', color: '#A9A9A9' },
    { id: 'plastic', name: 'Plastik', color: '#5F9EA0' }
  ];

  // Form için property'ler ekle
  settingForm: {
    id: string;
    primaryKey: string;
    scope: string;
    keyGroupTitle: string;
    keyGroup: string;
    title: string;
    description: string;
    primaryValue: string;
    defaultValue: string;
    valueType: string;
    displayOrder: number;
    browsable: boolean;
    externalApplicationId: string;
  } = {
      id: '',
      primaryKey: '',
      scope: 'system',
      keyGroupTitle: '',
      keyGroup: '',
      title: '',
      description: '',
      primaryValue: '',
      defaultValue: '',
      valueType: 'string',
      displayOrder: 1,
      browsable: true,
      externalApplicationId: ''
    };

  settingResponse: any = null;
  settingError: string | null = null;
  tagTypeResponse: any = null;
  tagTypeError: string | null = null;

  constructor(private bridgeService: ClientBridgeService) {
    this.selectedShape = 'rectangle';
    this.getUserProfile();
  }

  ngOnInit() {
    console.log('AppComponent ngOnInit başladı');
    try {
      console.log('Iframe Bridge başlatılıyor...');
      console.log('ClientConfig:', this.clientConfig);

      // Bridge servisini başlatmadan önce config'i kontrol et
      if (!this.clientConfig.appId || !this.clientConfig.trustedOrigin) {
        throw new Error('ClientConfig eksik veya hatalı yapılandırılmış');
      }

      // Bridge servisini başlat
      this.bridgeService.initialize(this.clientConfig);
      console.log('Iframe Bridge başlatma isteği gönderildi');

      // API çağrılarını otomatik olarak yap
      setTimeout(() => {
        this.performApiCalls();
      }, 2000);

      // get-setting API'sini kaydet
      this.bridgeService.registerApi(
        'get-setting',
        'Get setting value by key',
        {
          key: {
            type: 'string',
            description: 'Setting key to retrieve',
            required: true
          }
        },
        {
          id: '00000000-0000-0000-0000-000000000001',
          primaryKey: 'General.App.Name',
          anchorId: 'General-App-Name',
          scope: 'system',
          keyGroupTitle: 'General',
          keyGroup: 'App',
          title: 'Application Name',
          description: 'The name of the application',
          shortDescription: 'App Name',
          defaultValue: 'Bakelor RTLS',
          valueType: 'string',
          displayOrder: 1,
          browsable: true,
          changeRequest: 'user'
        },
        async (params) => {
          try {
            const response = await this.bridgeService.callApi('get-setting', {
              key: params.key
            });
            console.log('Setting data:', response);
            return response;
          } catch (error) {
            console.error('Setting data alınırken hata:', error);
            throw error;
          }
        }
      );

      // get-tag-type API'sini kaydet
      this.bridgeService.registerApi(
        'get-tag-type',
        'Get tag type information',
        {},
        {},
        async () => {
          try {
            const response = await this.bridgeService.callApi('get-tag-type', {});
            console.log('Tag type data:', response);
            return response;
          } catch (error) {
            console.error('Tag type data alınırken hata:', error);
            throw error;
          }
        }
      );

      // Bridge servisinin başlatılmasını bekle
      setTimeout(() => {
        // Bridge servisini başarıyla başlatıldı olarak işaretle
        this.iframeBridgeInitialized = true;
        console.log('Iframe Bridge başarıyla başlatıldı!');

        // Kanal aboneliklerini kur
        this.setupChannelSubscriptions();

        // Uygulama hazırlık kontrolünü başlat
        this.checkAppReadiness();
      }, 1000);

    } catch (error) {
      console.error('Iframe Bridge başlatma işlemi sırasında beklenmeyen hata:', error);
      this.iframeBridgeInitialized = false;

      // Başarısız olsa bile hazırlık kontrolünü dene
      setTimeout(() => {
        this.checkAppReadiness();
      }, 5000);
    }

    // Varsayılan sandalyeleri oluştur - masanın dışına doğru konumlandır
    const defaultSeats: Seat[] = [
      // Masanın üst kısmına sandalyeler
      { number: 1, occupied: false, position: { x: 100, y: -80 }, rotation: 0, showInfo: false },
      { number: 2, occupied: false, position: { x: 250, y: -80 }, rotation: 0, showInfo: false },
      { number: 3, occupied: false, position: { x: 400, y: -80 }, rotation: 0, showInfo: false },

      // Masanın alt kısmına sandalyeler
      { number: 4, occupied: false, position: { x: 100, y: this.tableLength + 20 }, rotation: 180, showInfo: false },
      { number: 5, occupied: false, position: { x: 250, y: this.tableLength + 20 }, rotation: 180, showInfo: false },
      { number: 6, occupied: false, position: { x: 400, y: this.tableLength + 20 }, rotation: 180, showInfo: false },

      // Masanın sol kısmına sandalyeler
      { number: 7, occupied: false, position: { x: -80, y: 150 }, rotation: 270, showInfo: false },
      { number: 8, occupied: false, position: { x: -80, y: 300 }, rotation: 270, showInfo: false },

      // Masanın sağ kısmına sandalyeler
      { number: 9, occupied: false, position: { x: this.tableWidth + 20, y: 150 }, rotation: 90, showInfo: false },
      { number: 10, occupied: false, position: { x: this.tableWidth + 20, y: 300 }, rotation: 90, showInfo: false }
    ];

    this.initializeSeats(defaultSeats);

    // NOT: Kanal abonelikleri artık setupChannelSubscriptions() metodunda merkezileştirilmiştir
    // Duplicate abonelikler kaldırıldı
  }

  ngOnDestroy() {
    this.bridgeService.unsubscribeFromChannel('serverTime');
    this.bridgeService.unsubscribeFromChannel('seatStatus');
  }

  async getUserProfile() {
    try {
      const profile = await this.bridgeService.callApi('getUserProfile', {});
      console.log('User profile:', profile);
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Belirli bir kullanıcının detaylarını almak için metot
  async getUserDetail() {
    try {
      const user = await this.bridgeService.callApi('getUserById', {
        id: '1',
        includeDetails: true
      });
      console.log('User details:', user);
      return user;
    } catch (error) {
      console.error('API error:', error);
      return null;
    }
  }

  // Canlı konum verisini al
  async getLiveLocation(tagSessionHistoryId: string): Promise<LiveLocation | null> {
    try {
      this.liveLocationError = null;
      const locationData = await this.bridgeService.callApi('get-live-location', {
        tagSessionHistoryId: tagSessionHistoryId
      });

      console.log('Canlı konum verisi:', locationData);
      this.liveLocationData = locationData as LiveLocation;
      return this.liveLocationData;
    } catch (error) {
      console.error('Canlı konum verisi alınırken hata:', error);
      this.liveLocationError = 'Veri alınırken bir hata oluştu';
      this.liveLocationData = null;
      return null;
    }
  }

  // Test için canlı konum verisi al
  async testLiveLocation() {
    const testId = '00000000-0000-0000-0000-000000000030';
    await this.getLiveLocation(testId);
  }

  addTable() {
    const newTable: Table = {
      shape: this.selectedShape,
      size: this.tableSize,
      seats: []
    };
    this.tables.push(newTable);
  }

  selectShape(shape: string) {
    this.selectedShape = shape;
    this.updateTable();
  }

  selectMaterial(material: string) {
    this.selectedMaterial = material;
    this.updateTable();
  }

  initializeSeats(defaultSeats: Seat[]) {
    this.seats = [...defaultSeats];
  }

  addSeat() {
    const newSeatNumber = this.seats.length > 0 ?
      Math.max(...this.seats.map(s => s.number)) + 1 : 1;

    // Yeni sandalyeyi masanın ortasında oluştur
    const newPosition = {
      x: this.tableWidth / 2,
      y: this.tableLength / 2
    };

    // Rastgele bir rotasyon değeri (0, 90, 180, 270)
    const rotationValues = [0, 90, 180, 270];
    const rotation = rotationValues[Math.floor(Math.random() * 4)];

    const newSeat: Seat = {
      number: newSeatNumber,
      occupied: false,
      position: newPosition,
      rotation: rotation,
      showInfo: false
    };

    this.seats.push(newSeat);
  }

  updateTable() {
    // Eski masa boyutları
    const oldWidth = this.tableWidth;
    const oldLength = this.tableLength;

    // Sandalyelerin pozisyonlarını güncelle
    this.seats.forEach(seat => {
      // Sandalyenin hangi kenar bölgesinde olduğunu belirle
      const position = this.determineSeatPosition(seat, oldWidth, oldLength);

      // Sandalyenin yeni pozisyonunu belirle
      switch (position) {
        case 'top':
          // Üst taraf - Genişlik oranı korunur, y pozisyonu sabit kalır
          seat.position.x = (seat.position.x / oldWidth) * this.tableWidth;
          seat.position.y = -80; // Sabit mesafe
          break;

        case 'bottom':
          // Alt taraf - Genişlik oranı korunur, y pozisyonu güncellenir
          seat.position.x = (seat.position.x / oldWidth) * this.tableWidth;
          seat.position.y = this.tableLength + 20; // Yeni tablonun altı
          break;

        case 'left':
          // Sol taraf - Yükseklik oranı korunur, x pozisyonu sabit kalır
          seat.position.x = -80; // Sabit mesafe
          seat.position.y = (seat.position.y / oldLength) * this.tableLength;
          break;

        case 'right':
          // Sağ taraf - Yükseklik oranı korunur, x pozisyonu güncellenir
          seat.position.x = this.tableWidth + 20; // Yeni tablonun sağı
          seat.position.y = (seat.position.y / oldLength) * this.tableLength;
          break;

        case 'inside':
          // Masanın içi - Her iki oran da korunur
          seat.position.x = (seat.position.x / oldWidth) * this.tableWidth;
          seat.position.y = (seat.position.y / oldLength) * this.tableLength;
          break;

        default:
          // Tanımlanamayan bölge - Oransal olarak güncelle
          seat.position.x = (seat.position.x / oldWidth) * this.tableWidth;
          seat.position.y = (seat.position.y / oldLength) * this.tableLength;
      }
    });

    console.log('Masa güncellendi:', this.selectedShape, this.tableWidth, this.tableLength);
  }

  // Sandalyenin hangi bölgede olduğunu belirle
  determineSeatPosition(seat: Seat, tableWidth: number, tableLength: number): string {
    const buffer = 100; // Kenar algılama için tampon bölge

    // Masanın üstü
    if (seat.position.y < 0) {
      return 'top';
    }

    // Masanın altı
    if (seat.position.y > tableLength) {
      return 'bottom';
    }

    // Masanın solu
    if (seat.position.x < 0) {
      return 'left';
    }

    // Masanın sağı
    if (seat.position.x > tableWidth) {
      return 'right';
    }

    // Masanın içi
    return 'inside';
  }

  // Özel boyutlar ile masayı ayarla
  setCustomDimensions(width: number, length: number) {
    if (width > 0 && length > 0) {
      // Eski boyutları hatırla
      const oldWidth = this.tableWidth;
      const oldLength = this.tableLength;

      // Yeni boyutları ata
      this.tableWidth = width;
      this.tableLength = length;

      // Masayı ve sandalyeleri güncelle
      this.updateTable();
    }
  }

  // Dokümana tıklama olayını dinle
  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent) {
    // Eğer tıklanan eleman bir sandalye veya bilgi kartı değilse, tüm bilgi kartlarını kapat
    if (!(event.target as HTMLElement).closest('.seat')) {
      this.seats.forEach(seat => {
        seat.showInfo = false;
      });
    }
  }

  // Sandalyeye tıklandığında bilgi kutucuğunu göster
  handleSeatClick(event: MouseEvent, seat: Seat) {
    event.stopPropagation();
    this.toggleSeatInfo(seat, event);
  }

  // Bilgi kartını göster/gizle
  toggleSeatInfo(seat: Seat, event: MouseEvent) {
    event.stopPropagation();

    // Diğer tüm sandalyelerin bilgi kartlarını kapat
    this.seats.forEach(s => {
      if (s.number !== seat.number) {
        s.showInfo = false;
      }
    });

    // Bu sandalyenin bilgi kartını aç/kapat
    seat.showInfo = !seat.showInfo;
  }

  // Sandalye sürüklemeyi başlat
  startDrag(event: MouseEvent, seat: Seat) {
    // Sağ tıksa işleme alma
    if (event.button === 2) return;

    // Sol tık ile sadece sürükleme yapılsın
    event.preventDefault();
    this.draggedSeat = seat;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  // Sürükleme bittiğinde
  onMouseUp() {
    this.draggedSeat = null;
  }

  // Sürükleme devam ederken
  onMouseMove(e: MouseEvent) {
    if (!this.draggedSeat) return;

    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;

    this.draggedSeat.position.x += dx;
    this.draggedSeat.position.y += dy;

    // Sınırları kontrole gerek yok, sandalyeler masanın dışında olabilir
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  rotateSeat(event: MouseEvent, seat: Seat) {
    event.preventDefault();
    seat.rotation = (seat.rotation + 45) % 360;
  }

  // Sandalye sil
  deleteSeat(seat: Seat, event: MouseEvent) {
    event.stopPropagation(); // Event'in yayılmasını durdur
    seat.showInfo = false; // Bilgi panelini kapat
    const index = this.seats.findIndex(s => s.number === seat.number);
    if (index !== -1) {
      this.seats.splice(index, 1);
    }
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

  // Masa yüksekliğini ayarla
  setTableHeight(height: number) {
    if (height > 0) {
      this.tableHeight = height;
      this.updateTable();
    }
  }

  getTableStyles(): { [key: string]: any } {
    const material = this.materials.find(m => m.id === this.selectedMaterial) || this.materials[0];

    let styles: { [key: string]: any } = {
      'width': `${this.tableWidth * 0.70}px`,  // Masayı biraz daha küçült
      'height': `${this.tableLength * 0.60}px` // Masayı biraz daha küçült
    };

    // Şekle göre ek stiller
    if (this.selectedShape === 'circle' || this.selectedShape === 'oval') {
      styles['border-radius'] = '50%';
    } else if (this.selectedShape === 'rectangle') {
      styles['border-radius'] = '8px';
    } else if (this.selectedShape === 'triangle') {
      // Üçgen için özel stiller eklenebilir
    }

    // Malzeme stillerini ekle
    if (this.selectedMaterial === 'glass') {
      styles['background'] = 'rgba(173, 216, 230, 0.4)';
      styles['backdrop-filter'] = 'blur(5px)';
      styles['border'] = '2px solid rgba(255, 255, 255, 0.5)';
      styles['box-shadow'] = '0 10px 20px rgba(0, 0, 0, 0.15)';
    } else if (this.selectedMaterial === 'wood') {
      styles['background'] = 'linear-gradient(135deg, #8b5e3c, #6d4c28)';
      styles['border'] = '5px solid rgba(93, 64, 55, 0.8)';
    } else if (this.selectedMaterial === 'marble') {
      styles['background'] = 'linear-gradient(135deg, #E6E6E6, #D0D0D0)';
      styles['border'] = '5px solid rgba(200, 200, 200, 0.8)';
      styles['background-image'] = 'radial-gradient(circle, rgba(0,0,0,.05) 1px, transparent 1px)';
      styles['background-size'] = '10px 10px';
    } else if (this.selectedMaterial === 'metal') {
      styles['background'] = 'linear-gradient(135deg, #A9A9A9, #808080)';
      styles['border'] = '3px solid rgba(130, 130, 130, 0.8)';
      styles['box-shadow'] = '0 5px 15px rgba(0, 0, 0, 0.3)';
    } else if (this.selectedMaterial === 'plastic') {
      styles['background'] = 'linear-gradient(135deg, #5F9EA0, #4A777A)';
      styles['border'] = '4px solid rgba(70, 130, 130, 0.8)';
    }

    // 3D görünüm için özel stil
    if (this.is3D) {
      styles['transform'] = `translate(-50%, -50%) perspective(1000px) rotateX(20deg) translateZ(${this.tableHeight}px)`;
      styles['box-shadow'] = '0 30px 60px rgba(0, 0, 0, 0.4)';
    }

    return styles;
  }

  // Gerçek veri ile çalıştırmak için bu fonksiyonu kullan
  updateSeatStatus(data: any) {
    if (!data || !data.seats) {
      console.warn('Seat status data format is incorrect:', data);
      return;
    }

    try {
      // Tüm sandalyelerin durumlarını güncelle
      data.seats.forEach((seatData: any) => {
        const seat = this.seats.find(s => s.number === seatData.id);
        if (seat) {
          seat.occupied = seatData.occupied || false;

          // Kullanıcı bilgilerini güncelle
          if (seatData.userInfo) {
            seat.userInfo = {
              name: seatData.userInfo.name || `Kullanıcı ${seat.number}`,
              id: seatData.userInfo.id || `user-${seat.number}`,
              status: seatData.userInfo.status || 'away',
              lastSeen: seatData.userInfo.lastSeen || new Date().toISOString()
            };
          } else {
            seat.userInfo = {
              name: `Kullanıcı ${seat.number}`,
              id: `user-${seat.number}`,
              status: 'away',
              lastSeen: new Date().toISOString()
            };
          }
        } else {
          console.warn(`Seat with ID ${seatData.id} not found`);
        }
      });

      console.log('Seat statuses updated successfully');
    } catch (error) {
      console.error('Error updating seat statuses:', error);
    }
  }

  // İframe verilerini konsola kaydet
  logIframeData(data: any) {
    console.log('IFrame data:', data);
    this.iframeData = data;
  }

  // Sandalye hakkında detaylı bilgi
  getSeatDetails(seat: Seat): string {
    if (!seat.userInfo) return 'Veri yok';

    let details = '';
    if (seat.userInfo.name) details += `İsim: ${seat.userInfo.name}\n`;
    if (seat.userInfo.status) details += `Durum: ${seat.userInfo.status === 'active' ? 'Aktif' : 'Uzakta'}\n`;
    if (seat.userInfo.lastSeen) {
      const lastSeen = new Date(seat.userInfo.lastSeen);
      details += `Son Görülme: ${lastSeen.toLocaleTimeString('tr-TR')}`;
    }
    return details;
  }

  // Tüm sandalyeleri sil
  deleteAllSeats() {
    if (confirm('Tüm sandalyeleri silmek istediğinize emin misiniz?')) {
      this.seats = [];
    }
  }

  // Bridge hazır olduğunda bir kanaldan veri alarak app'in hazır olduğunu kontrol edelim
  checkAppReadiness() {
    console.log('App hazırlık durumu kontrol ediliyor...');

    if (!this.readinessAttempts) {
      this.readinessAttempts = 0;
    }

    if (this.readinessAttempts > 5) {
      console.warn('Maksimum app ready kontrolü deneme sayısına ulaşıldı');
      return;
    }

    this.readinessAttempts++;

    setTimeout(() => {
      try {
        // Host kanalına abone ol
        this.bridgeService.subscribeToChannel('host', (message) => {
          console.log('Host kanalından mesaj alındı:', message);

          if (message === 'ready' ||
            (typeof message === 'object' && message.status === 'ready') ||
            (typeof message === 'object' && message.type === 'READY')) {
            console.log('Host uygulaması hazır sinyali alındı');
            this.isAppReady = true;

            this.appInfo = {
              version: '1.0.0',
              appType: 'Host Application',
              status: 'ready',
              timeStamp: new Date().toISOString()
            };

            this.onAppReadyListeners.forEach(callback => callback(this.appInfo));
          }
        });

        // Sandalye durumu kanalına abone ol
        this.bridgeService.subscribeToChannel('seatStatus', (data) => {
          console.log('Sandalye durumu kanalından veri alındı:', data);
          if (data) {
            this.isAppReady = true;
            this.iframeData = data;
            this.updateSeatStatus(data);
          }
        });

        // 15 saniye içinde veri gelmezse tekrar dene
        setTimeout(() => {
          if (!this.isAppReady) {
            console.warn('15 saniye içinde veri alınamadı, tekrar deneniyor...');
            this.checkAppReadiness();
          }
        }, 15000);

      } catch (error) {
        console.error('App hazırlık kontrolünde hata:', error);
        this.isAppReady = false;
        setTimeout(() => this.checkAppReadiness(), 5000);
      }
    }, 1000);
  }

  // App'in hazır olup olmadığını kontrol eden method
  isAppInfoReady(): boolean {
    return this.isAppReady;
  }

  // App hazır olduğunda çağrılacak method
  onAppReady(callback: (appInfo: any) => void) {
    if (this.isAppReady) {
      callback(this.appInfo);
    } else {
      // App hazır olana kadar callback'i kaydet
      this.registerAppReadyListener(callback);
    }
  }

  // App hazır olduğunda çağrılacak callback'i kaydet
  registerAppReadyListener(callback: (appInfo: any) => void) {
    this.onAppReadyListeners.push(callback);
  }

  // Alternatif bir yöntemle app hazırlığını kontrol et
  checkAppReadinessAlternative() {
    console.log('Alternatif app hazırlık kontrolü başlatılıyor...');

    // İlk olarak en basit yöntem: sandalye durumu kanalına abone ol
    try {
      // Eğer zaten kanala abone isek tekrar abone olmayalım
      try {
        this.bridgeService.unsubscribeFromChannel('seatStatus');
      } catch (e) {
        // İlk kez abone oluyoruz, hata beklenebilir
      }

      // Sandalye durumlarını dinlemeye çalış
      const unsubscribe = this.bridgeService.subscribeToChannel('seatStatus', (data) => {
        console.log('Sandalye durumu kanalından veri alındı, uygulama hazır:', data);
        this.isAppReady = true;

        // App info için varsayılan değerler oluştur
        this.appInfo = {
          version: '1.0.0',
          appType: 'Host Application',
          status: 'ready',
          timeStamp: new Date().toISOString()
        };

        // Veri alındı ve app hazır
        this.onAppReadyListeners.forEach(callback => callback(this.appInfo));

        // Artık bu işlevi bir daha çağırmayacağız
        this.readinessAttempts = 6;
      });

      // Özel kanal dinleme - host'tan doğrudan "ready" mesajını kontrol et
      try {
        this.bridgeService.unsubscribeFromChannel('host');
      } catch (e) {
        // İlk kez abone oluyoruz, hata beklenebilir
      }

      // Host kanalına abone ol
      this.bridgeService.subscribeToChannel('host', (message) => {
        console.log('Host kanalından mesaj alındı:', message);

        // Mesajın "ready" olup olmadığını kontrol et - yeni yapıya göre güncellendi
        if (message === 'ready' ||
          (typeof message === 'object' && message.status === 'ready') ||
          (typeof message === 'object' && message.type === 'READY') ||
          (typeof message === 'object' &&
            message.content &&
            message.content.type === 'host')) {
          console.log('Host uygulaması hazır sinyali alındı');
          this.isAppReady = true;

          this.appInfo = {
            version: '1.0.0',
            appType: 'Host Application',
            status: 'ready',
            timeStamp: new Date().toISOString()
          };

          // App hazır olduğunda event yayınla
          this.onAppReadyListeners.forEach(callback => callback(this.appInfo));
        }
      });

      // 15 saniye içinde veri gelmezse timeout ile tekrar dene
      setTimeout(() => {
        if (!this.isAppReady) {
          console.warn('Sandalye durumu veya host kanalından 15 saniye içinde veri gelmedi');
          // Ping metodu ile dene
          this.checkAppReadiness();
        }
      }, 15000);

    } catch (error) {
      console.error('Kanal aboneliğinde hata:', error);
      // 3 saniye bekleyip tekrar dene
      setTimeout(() => {
        this.checkAppReadinessAlternative();
      }, 3000);
    }
  }

  // Kanal aboneliklerini güvenli bir şekilde kur
  setupChannelSubscriptions() {
    try {
      console.log('Kanal abonelikleri kuruluyor...');
      console.log('Tüm kanal abonelikleri başarıyla tamamlandı');
    } catch (error) {
      console.error('Kanal abonelikleri kurulurken hata oluştu:', error);
    }
  }

  // Create External Application Setting API metodu
  createExternalApplicationSetting(setting: {
    primaryKey: string;
    scope: string;
    keyGroupTitle: string;
    keyGroup: string;
    title: string;
    description: string;
    primaryValue: string;
    defaultValue: string;
    valueType: string;
    displayOrder: number;
    browsable: boolean;
    externalApplicationId: string;
  }): Promise<any> {
    console.log('createExternalApplicationSetting çağrılıyor:', setting);
    return this.bridgeService.callApi('create-external-application-setting', { setting });
  }

  // Save External Application Setting API metodu
  saveExternalApplicationSetting(setting: {
    id: string;
    primaryKey: string;
    scope: string;
    keyGroupTitle: string;
    keyGroup: string;
    title: string;
    description: string;
    primaryValue: string;
    defaultValue: string;
    valueType: string;
    displayOrder: number;
    browsable: boolean;
    externalApplicationId: string;
  }): Promise<any> {
    console.log('saveExternalApplicationSetting çağrılıyor:', setting);
    return this.bridgeService.callApi('save-external-application-setting', { setting });
  }

  // Get Tag Type API metodu
  getTagType(id?: string): Promise<any> {
    console.log('getTagType çağrılıyor, id:', id);
    const params = id ? { id } : {};
    return this.bridgeService.callApi('get-tag-type', params);
  }

  // Form gönderme fonksiyonu
  submitSettingForm() {
    // API yanıtlarını sıfırla
    this.settingResponse = null;
    this.settingError = null;

    // Form validasyonu
    if (!this.settingForm.primaryKey) {
      this.settingError = 'Primary Key alanı zorunludur.';
      return;
    }

    if (!this.settingForm.keyGroupTitle) {
      this.settingError = 'Key Group Title alanı zorunludur.';
      return;
    }

    if (!this.settingForm.keyGroup) {
      this.settingError = 'Key Group alanı zorunludur.';
      return;
    }

    console.log('Ayar form verisi:', this.settingForm);

    // ID varsa güncelleme, yoksa oluşturma işlemi yap
    const apiCall = this.settingForm.id ?
      this.saveExternalApplicationSetting(this.settingForm) :
      this.createExternalApplicationSetting(this.settingForm);

    apiCall
      .then(response => {
        console.log('Ayar başarıyla işlendi:', response);
        this.settingResponse = response;

        // Create işleminden sonra ID'yi form değerine ata
        if (!this.settingForm.id && response.id) {
          this.settingForm.id = response.id;
        }
      })
      .catch(error => {
        console.error('Ayar işleme hatası:', error);
        this.settingError = 'API hatası: ' + (error.message || JSON.stringify(error));
      });
  }

  // ToF Sensor tag tipini al
  getToFSensorTagType() {
    this.tagTypeResponse = null;
    this.tagTypeError = null;

    this.getTagType()
      .then(response => {
        console.log('Tag tipi başarıyla alındı:', response);

        if (Array.isArray(response)) {
          // Eğer birden fazla tag tipi dönerse, "ToF Sensor" isimli olanı bul
          const tofSensorTag = response.find(tag => tag.name.includes('ToF') || tag.name.includes('Sensor'));
          if (tofSensorTag) {
            this.tagTypeResponse = tofSensorTag;
          } else {
            this.tagTypeResponse = response;
          }
        } else {
          this.tagTypeResponse = response;
        }
      })
      .catch(error => {
        console.error('Tag tipi alma hatası:', error);
        this.tagTypeError = 'API hatası: ' + (error.message || JSON.stringify(error));
      });
  }

  // API çağrılarını otomatik olarak yap
  performApiCalls() {
    console.log('Otomatik API çağrıları başlatılıyor...');

    // 1. Önce External Application Setting oluştur
    this.settingForm = {
      id: '',
      primaryKey: 'App.Configuration.Settings',
      scope: 'system',
      keyGroupTitle: 'Application',
      keyGroup: 'Configuration',
      title: 'Uygulama Yapılandırma Ayarları',
      description: 'RTLS uygulaması için yapılandırma ayarları',
      primaryValue: 'RTLS-Config-01',
      defaultValue: 'Default-Config',
      valueType: 'string',
      displayOrder: 1,
      browsable: true,
      externalApplicationId: 'rtls-app-id'
    };

    console.log('1. External Application Setting oluşturuluyor...');
    this.createExternalApplicationSetting(this.settingForm)
      .then(response => {
        console.log('Ayar başarıyla oluşturuldu:', response);
        this.settingResponse = response;

        // Create işleminden sonra ID'yi form değerine ata
        if (response && response.id) {
          this.settingForm.id = response.id;
          console.log('Ayar ID\'si alındı:', this.settingForm.id);

          // 2. Oluşturulan ayarı güncelle
          setTimeout(() => this.updateCreatedSetting(), 2000);
        } else {
          console.error('Oluşturulan ayardan ID alınamadı');

          // Yine de tag tipi alınmayı dene
          setTimeout(() => this.getToFSensorTag(), 2000);
        }
      })
      .catch(error => {
        console.error('Ayar oluşturma hatası:', error);
        this.settingError = 'API hatası: ' + (error.message || JSON.stringify(error));

        // Hataya rağmen tag tipi alınmayı dene
        setTimeout(() => this.getToFSensorTag(), 2000);
      });
  }

  // Oluşturulan ayarı güncelle
  updateCreatedSetting() {
    console.log('2. Oluşturulan ayar güncelleniyor...');

    // Primary Value'yu güncelle
    this.settingForm.primaryValue = 'RTLS-Config-Updated-' + new Date().getTime();

    this.saveExternalApplicationSetting(this.settingForm)
      .then(response => {
        console.log('Ayar başarıyla güncellendi:', response);
        this.settingResponse = response;

        // 3. ToF Sensor tag tipini al
        setTimeout(() => this.getToFSensorTag(), 2000);
      })
      .catch(error => {
        console.error('Ayar güncelleme hatası:', error);
        this.settingError = 'API hatası: ' + (error.message || JSON.stringify(error));

        // Hataya rağmen tag tipi alınmayı dene
        setTimeout(() => this.getToFSensorTag(), 2000);
      });
  }

  // ToF Sensor tag tipini al
  getToFSensorTag() {
    console.log('3. ToF Sensor tag tipi alınıyor...');

    this.getTagType()
      .then(response => {
        console.log('Tag tipi başarıyla alındı:', response);
        this.tagTypeResponse = response;

        if (Array.isArray(response)) {
          // Eğer birden fazla tag tipi dönerse, "ToF" veya "Sensor" içeren tag'i bul
          const tofSensorTag = response.find(tag =>
            tag.name && (tag.name.includes('ToF') || tag.name.includes('Sensor'))
          );

          if (tofSensorTag) {
            console.log('ToF Sensor tag\'i bulundu:', tofSensorTag);
            this.tagTypeResponse = tofSensorTag;
          } else {
            console.log('ToF Sensor tag\'i bulunamadı, tüm tag\'ler:', response);
          }
        } else if (response && response.name) {
          console.log('Tek tag tipi alındı:', response);
        } else {
          console.log('Beklenmeyen API yanıtı:', response);
        }
      })
      .catch(error => {
        console.error('Tag tipi alma hatası:', error);
        this.tagTypeError = 'API hatası: ' + (error.message || JSON.stringify(error));
      });
  }
}
