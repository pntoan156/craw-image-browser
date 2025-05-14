const puppeteer = require('puppeteer');

(async () => {
  // Khởi động trình duyệt
  const browser = await puppeteer.launch({
    headless: false, // Chạy ở chế độ có giao diện để dễ debug
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Mô phỏng hành vi người dùng
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  await page.setViewport({ width: 1366, height: 768 });

  // Truy cập trang đăng nhập Shopee
  await page.goto('https://shopee.vn/buyer/login', { waitUntil: 'networkidle2' });

  // Điền thông tin đăng nhập
  await page.type('input[name="loginKey"]', 'pntoan156@gmail.com'); // Thay bằng tài khoản của bạn
  await page.type('input[name="password"]', 'Toanvippro'); // Thay bằng mật khẩu của bạn

  // Nhấn nút đăng nhập bằng cách tìm theo text "đăng nhập"
  await page.evaluate(() => {
    // Tìm các phần tử có thể click và chứa text "đăng nhập" (không phân biệt hoa thường)
    const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span, input[type="button"]'));
    const loginButton = elements.find(el =>
      el.innerText && el.innerText.toLowerCase().includes('đăng nhập')
    );
    
    if (loginButton) {
      loginButton.click();
      return true;
    }
    return false;
  });

  // Sau khi click nút đăng nhập, chờ một chút để trang phản hồi
  await page.waitForTimeout(3000);
  
  console.log('Đang kiểm tra các bước xác thực...');
  
  // Hàm kiểm tra và xử lý xác thực
  async function handleVerification() {
    // Kiểm tra các loại xác thực phổ biến
    
    // 1. Kiểm tra OTP (xác thực qua SMS)
    const hasOTP = await page.evaluate(() => {
      // Tìm các phần tử liên quan đến OTP
      const elements = document.querySelectorAll('input[type="tel"], input[maxlength="6"], input[maxlength="4"]');
      const textElements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, h5');
      
      // Tìm text liên quan đến mã xác thực
      for (const el of textElements) {
        if (el.innerText && (
          el.innerText.toLowerCase().includes('mã xác thực') ||
          el.innerText.toLowerCase().includes('mã xác nhận') ||
          el.innerText.toLowerCase().includes('otp') ||
          el.innerText.toLowerCase().includes('xác minh')
        )) {
          return true;
        }
      }
      
      return elements.length > 0;
    });
    
    if (hasOTP) {
      console.log('Phát hiện yêu cầu nhập mã OTP! Vui lòng nhập mã xác thực...');
      // Chờ người dùng nhập OTP thủ công (60 giây)
      await page.waitForTimeout(60000);
      return true;
    }
    
    // 2. Kiểm tra CAPTCHA
    const hasCaptcha = await page.evaluate(() => {
      // Tìm các phần tử liên quan đến CAPTCHA
      const captchaElements = document.querySelectorAll('img[alt*="captcha"], div[class*="captcha"], canvas');
      const textElements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, h5');
      
      // Tìm text liên quan đến captcha
      for (const el of textElements) {
        if (el.innerText && (
          el.innerText.toLowerCase().includes('captcha') ||
          el.innerText.toLowerCase().includes('xác nhận bạn không phải robot')
        )) {
          return true;
        }
      }
      
      return captchaElements.length > 0;
    });
    
    if (hasCaptcha) {
      console.log('Phát hiện CAPTCHA! Vui lòng giải CAPTCHA...');
      // Chờ người dùng giải CAPTCHA thủ công (60 giây)
      await page.waitForTimeout(60000);
      return true;
    }
    
    // 3. Kiểm tra Slider Puzzle (thách thức trượt)
    const hasSlider = await page.evaluate(() => {
      // Tìm các phần tử liên quan đến slider puzzle
      const sliderElements = document.querySelectorAll('div[class*="slider"], div[class*="puzzle"], div[class*="drag"]');
      const textElements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, h5');
      
      // Tìm text liên quan đến slider
      for (const el of textElements) {
        if (el.innerText && (
          el.innerText.toLowerCase().includes('kéo') ||
          el.innerText.toLowerCase().includes('trượt') ||
          el.innerText.toLowerCase().includes('slide to verify')
        )) {
          return true;
        }
      }
      
      return sliderElements.length > 0;
    });
    
    if (hasSlider) {
      console.log('Phát hiện Slider Puzzle! Vui lòng hoàn thành thử thách trượt...');
      // Chờ người dùng hoàn thành slider puzzle thủ công (60 giây)
      await page.waitForTimeout(60000);
      return true;
    }
    
    // 4. Kiểm tra trang đã chuyển hướng thành công (đăng nhập thành công)
    const isLoggedIn = await page.evaluate(() => {
      // Kiểm tra các dấu hiệu đăng nhập thành công
      const userElements = document.querySelectorAll('div[class*="user"], div[class*="account"], div[class*="profile"]');
      return userElements.length > 0;
    });
    
    if (isLoggedIn) {
      console.log('Đã đăng nhập thành công!');
      return false; // Không cần xử lý thêm
    }
    
    // Nếu không phát hiện loại xác thực nào, cho thêm thời gian để xử lý thủ công
    console.log('Không xác định được bước xác thực cụ thể. Vui lòng hoàn thành mọi bước xác thực thủ công...');
    await page.waitForTimeout(60000);
    return true;
  }
  
  // Xử lý các bước xác thực cho đến khi hoàn thành
  let verificationNeeded = true;
  let maxAttempts = 3;
  let attempts = 0;
  
  while (verificationNeeded && attempts < maxAttempts) {
    attempts++;
    console.log(`Đang xử lý bước xác thực (lần thử ${attempts}/${maxAttempts})...`);
    verificationNeeded = await handleVerification();
    
    if (verificationNeeded && attempts < maxAttempts) {
      console.log('Đang kiểm tra lại sau khi xử lý xác thực...');
      await page.waitForTimeout(3000);
    }
  }
  
  console.log('Quá trình xác thực hoàn tất, tiếp tục chương trình...');
  
  // Chờ điều hướng sau khi xác thực hoàn tất
  await page.waitForTimeout(3000);
  
  // Truy cập gian hàng (thay URL bằng gian hàng bạn muốn)
  const shopUrl = 'https://shopee.vn/coolmate.vn';
  await page.goto(shopUrl, { waitUntil: 'networkidle2' });

  // Lấy danh sách URL ảnh từ gian hàng
  const imageUrls = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    return images.map(img => img.src).filter(src => src.includes('shopee')); // Lọc ảnh liên quan đến Shopee
  });

  console.log('Danh sách URL ảnh:', imageUrls);

  // (Tùy chọn) Tải ảnh về máy
  const fs = require('fs').promises;
  for (let i = 0; i < imageUrls.length; i++) {
    const response = await page.goto(imageUrls[i]);
    const buffer = await response.buffer();
    await fs.writeFile(`image_${i}.jpg`, buffer);
  }

  // Đóng trình duyệt
  await browser.close();
})();