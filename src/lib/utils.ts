export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return 'Rp 0';
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

export function formatNumber(amount: number): string {
  if (isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('id-ID');
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    // If YYYY-MM-DD
    if (parts[0].length === 4) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${day} ${months[monthIndex] || parts[1]} ${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function terbilang(nominal: number): string {
  const bilangan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  function bilang(n: number): string {
    let hasil = '';
    n = Math.floor(Math.abs(n));

    if (n < 12) {
      hasil = bilangan[n];
    } else if (n < 20) {
      hasil = bilang(n - 10) + ' Belas';
    } else if (n < 100) {
      hasil = bilang(Math.floor(n / 10)) + ' Puluh ' + bilang(n % 10);
    } else if (n < 200) {
      hasil = 'Seratus ' + bilang(n - 100);
    } else if (n < 1000) {
      hasil = bilang(Math.floor(n / 100)) + ' Ratus ' + bilang(n % 100);
    } else if (n < 2000) {
      hasil = 'Seribu ' + bilang(n - 1000);
    } else if (n < 1000000) {
      hasil = bilang(Math.floor(n / 1000)) + ' Ribu ' + bilang(n % 1000);
    } else if (n < 1000000000) {
      hasil = bilang(Math.floor(n / 1000000)) + ' Juta ' + bilang(n % 1000000);
    } else if (n < 1000000000000) {
      hasil = bilang(Math.floor(n / 1000000000)) + ' Miliar ' + bilang(n % 1000000000);
    } else if (n < 1000000000000000) {
      hasil = bilang(Math.floor(n / 1000000000000)) + ' Triliun ' + bilang(n % 1000000000000);
    }

    return hasil.replace(/\s+/g, ' ').trim();
  }

  if (nominal === 0) return 'Nol Rupiah';
  const hasil = bilang(nominal);
  return hasil.trim() + ' Rupiah';
}

/**
 * Dynamically updates the browser tab favicon and title across all browsers.
 * Replaces link elements to force Chrome, Safari, Firefox, and Edge to immediately repaint the tab icon.
 * Supports image URLs, relative paths, and base64 data URLs.
 */
export function updateBrowserBranding(faviconUrl?: string, title?: string) {
  if (typeof document === 'undefined') return;

  if (title && title.trim()) {
    document.title = title.trim();
  }

  if (faviconUrl && faviconUrl.trim()) {
    const cleanUrl = faviconUrl.trim();

    try {
      // 1. Remove all old icon links to bypass browser tab cache and trigger immediate repaint
      const oldIcons = document.querySelectorAll<HTMLLinkElement>(
        "link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']"
      );
      oldIcons.forEach((el) => {
        try {
          el.remove();
        } catch (e) {}
      });

      // 2. Create primary favicon link
      const iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.href = cleanUrl;
      if (cleanUrl.startsWith('data:image/svg') || cleanUrl.endsWith('.svg')) {
        iconLink.type = 'image/svg+xml';
      } else if (cleanUrl.startsWith('data:image/png') || cleanUrl.endsWith('.png')) {
        iconLink.type = 'image/png';
      } else if (cleanUrl.startsWith('data:image/x-icon') || cleanUrl.endsWith('.ico')) {
        iconLink.type = 'image/x-icon';
      }
      document.head.appendChild(iconLink);

      // 3. Create shortcut icon link (for Edge and older browsers)
      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.href = cleanUrl;
      document.head.appendChild(shortcutLink);

      // 4. Create apple-touch-icon (for mobile Safari & home screen bookmarks)
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = cleanUrl;
      document.head.appendChild(appleLink);
    } catch (e) {
      console.warn('Could not update browser tab favicon:', e);
    }
  }
}

