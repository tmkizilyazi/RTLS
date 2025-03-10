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

  materials = [
    { id: 'wood', name: 'Ahşap', color: '#8b5e3c' },
    { id: 'glass', name: 'Cam', color: 'rgba(173, 216, 230, 0.6)' },
    { id: 'marble', name: 'Mermer', color: '#E6E6E6' },
    { id: 'metal', name: 'Metal', color: '#A9A9A9' },
    { id: 'plastic', name: 'Plastik', color: '#5F9EA0' }
  ];

  constructor(private bridgeService: ClientBridgeService) {
    this.selectedShape = 'rectangle';
    this.getUserProfile();
  }

  ngOnInit() {
    console.log('AppComponent ngOnInit başladı');
    try {
      console.log('Iframe Bridge başlatılıyor...');
      // Bridge servisini başlat ve sonucu bekle
      this.bridgeService.initialize(this.clientConfig);
      console.log('Iframe Bridge başarıyla başlatıldı!');
      this.iframeBridgeInitialized = true;

      // Kanal aboneliklerini kur
      this.setupChannelSubscriptions();

      // Uygulama hazırlık kontrolünü başlat
      this.checkAppReadinessAlternative();

      // Eğer 10 saniye içinde alternatif yöntem ile hazırlık tespit edilmezse
      // ping yöntemini dene
      setTimeout(() => {
        if (!this.isAppReady) {
          console.log('Alternatif hazırlık kontrolü başarısız oldu, ping ile kontrol deneniyor...');
          this.checkAppReadiness();
        }
      }, 10000);

      // Veri almak için istek gönder
      try {
        console.log('getSeatStatus veri isteği gönderiliyor...');
        this.bridgeService.requestData('getSeatStatus', Date.now().toString());
      } catch (reqError) {
        console.warn('Veri isteği gönderilemedi, ancak bridge başlatıldı:', reqError);
      }
    } catch (error) {
      console.error('Iframe Bridge başlatma işlemi sırasında beklenmeyen hata:', error);
      this.iframeBridgeInitialized = false;

      // Başarısız olsa bile hazırlık kontrolünü dene
      setTimeout(() => {
        this.checkAppReadinessAlternative();
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

    // Maksimum deneme sayımız olsun
    if (!this.readinessAttempts) {
      this.readinessAttempts = 0;
    }

    // Maksimum deneme sayısını aşmamalıyız
    if (this.readinessAttempts > 5) {
      console.warn('Maksimum app ready kontrolü deneme sayısına ulaşıldı');
      return;
    }

    this.readinessAttempts++;

    // Timeout ile uygulamanın hazır olması için bir süre bekleyelim
    setTimeout(() => {
      try {
        // Host uygulamasında kayıtlı olan ping API'sini kullanarak app'in hazır olduğunu doğrulayalım
        this.bridgeService.callApi('ping', {}).then(
          (response) => {
            console.log('Ping yanıtı alındı:', response);

            // Ping yanıtı başarılı ise app'i hazır olarak işaretle
            this.isAppReady = true;

            // App info için varsayılan değerler oluştur
            this.appInfo = {
              version: '1.0.0',
              appType: 'Host Application',
              status: 'ready',
              timeStamp: new Date().toISOString()
            };

            // App hazır olduğunda event yayınla
            this.onAppReadyListeners.forEach(callback => callback(this.appInfo));
          },
          (error) => {
            console.error('Ping yanıtı alınamadı:', error);
            // 3 saniye sonra tekrar dene
            setTimeout(() => this.checkAppReadiness(), 3000);
          }
        );
      } catch (error) {
        console.error('App hazırlık kontrolünde hata:', error);
        this.isAppReady = false;
        // 5 saniye sonra tekrar dene
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
      // App hazır olduğunda çağrılacak callback'i kaydet
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

      // 10 saniye içinde veri gelmezse timeout ile tekrar dene
      setTimeout(() => {
        if (!this.isAppReady) {
          console.warn('Sandalye durumu kanalından 10 saniye içinde veri gelmedi');
          // Ping metodu ile dene
          this.checkAppReadiness();
        }
      }, 10000);

    } catch (error) {
      console.error('Kanal aboneliğinde hata:', error);
      // Ping metodu ile dene
      this.checkAppReadiness();
    }
  }

  // Kanal aboneliklerini güvenli bir şekilde kur
  setupChannelSubscriptions() {
    try {
      console.log('Kanal abonelikleri kuruluyor...');

      // Mevcut abonelikleri temizle
      try {
        this.bridgeService.unsubscribeFromChannel('seatStatus');
        this.bridgeService.unsubscribeFromChannel('serverTime');
      } catch (e) {
        // Temizleme hatası, devam et
      }

      // Sandalye durumlarını dinle - Güvenli abonelik
      try {
        this.bridgeService.subscribeToChannel('seatStatus', (data) => {
          console.log('Sandalye durumu kanalından veri alındı:', data);
          this.iframeData = data;
          this.updateSeatStatus(data);

          // Veri alındığında uygulama hazır
          if (!this.isAppReady) {
            this.isAppReady = true;
            this.appInfo = {
              version: '1.0.0',
              status: 'ready',
              timeStamp: new Date().toISOString()
            };
            this.onAppReadyListeners.forEach(callback => callback(this.appInfo));
          }
        });
        console.log('Sandalye durumu kanalına başarıyla abone olundu');
      } catch (error) {
        console.error('Sandalye durumu kanalına abone olunamadı:', error);
      }

      // Sunucu zamanını dinle - Güvenli abonelik
      try {
        this.bridgeService.subscribeToChannel('serverTime', (data) => {
          console.log('Sunucu zamanı kanalından veri alındı:', data);
        });
        console.log('Sunucu zamanı kanalına başarıyla abone olundu');
      } catch (error) {
        console.error('Sunucu zamanı kanalına abone olunamadı:', error);
      }
    } catch (error) {
      console.error('Kanal abonelikleri kurulurken hata oluştu:', error);
    }
  }
}
