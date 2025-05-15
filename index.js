const puppeteer = require('puppeteer');

async function start(shopUrl, maxPages = 5, onProgress) {
  // Kết nối với trình duyệt đang chạy
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  // Lấy trang đầu tiên đang mở
  const pages = await browser.pages();
  const page = pages[0];

  // Truy cập gian hàng
  await page.goto(shopUrl, { waitUntil: 'networkidle2' });
  
  let allProducts = [];
  let currentPage = 1;

  while (currentPage <= maxPages) {
    console.log(`Đang crawl trang ${currentPage}...`);
    
    // Đợi 2s để trang load hoàn toàn
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scroll xuống dưới và đợi load
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        let lastHeight = 0;
        let sameHeightCount = 0;
        
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (scrollHeight === lastHeight) {
            sameHeightCount++;
            if (sameHeightCount >= 5) {
              clearInterval(timer);
              resolve();
            }
          } else {
            sameHeightCount = 0;
            lastHeight = scrollHeight;
          }

          if(totalHeight >= scrollHeight || totalHeight > 100000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const products = await page.evaluate(() => {
      const productContainer = document.querySelector('.shop-all-product-view');
      if (!productContainer) return [];
      
      const productElements = Array.from(productContainer.querySelectorAll('.shop-search-result-view__item'));
      return productElements.map(item => {
        const img = item.querySelector('img');
        const name = item.querySelector('a.contents div.line-clamp-2.break-words');
        return {
          img: img ? img.src : '',
          inventory_item_name: name ? name.textContent.trim() : ''
        };
      }).filter(product => product.img && product.img.includes('.webp'));
    });

    allProducts = [...allProducts, ...products];
    console.log(`Đã crawl xong trang ${currentPage}, tìm thấy ${products.length} sản phẩm`);

    // Gửi tiến trình
    if (onProgress) {
      onProgress(currentPage, maxPages);
    }

    const clicked = await page.evaluate(() => {
      const solidButton = document.querySelector('.shopee-button-solid');
      if (!solidButton) return false;
      
      const nextButton = solidButton.nextElementSibling;
      if (nextButton && nextButton.classList.contains('shopee-button-no-outline')) {
        nextButton.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      console.log('Không tìm thấy nút tiếp theo');
      break;
    }

    currentPage++;
  }

  await browser.disconnect();
  return allProducts;
}

module.exports = { start };