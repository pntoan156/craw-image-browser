const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const axios = require('axios');
const archiver = require('archiver');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Progress endpoint
app.get('/api/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Store the response object to send progress updates
    global.progressRes = res;
    
    req.on('close', () => {
        global.progressRes = null;
    });
});

// Download endpoint
app.post('/api/download', async (req, res) => {
    const { images, productNames } = req.body;
    const tempDir = path.join(os.tmpdir(), 'shopee-images');
    const imagesDir = path.join(tempDir, 'images');
    
    // Create temp directories if they don't exist
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir);
    }

    // Create a zip archive
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Create CSV data
    const csvRows = ['id,name,file_name']; // Header row

    // Download, convert and add each image to the archive
    for (let i = 0; i < images.length; i++) {
        try {
            const response = await axios({
                url: images[i],
                responseType: 'arraybuffer'
            });
            
            const fileId = uuidv4();
            const filename = `${fileId}.jpg`;

            // Convert image to JPG using sharp
            const convertedImage = await sharp(response.data)
                .jpeg({ quality: 90 })
                .toBuffer();

            // Add to archive
            archive.append(convertedImage, { name: `images/${filename}` });

            // Add CSV row
            csvRows.push(`${fileId},"${productNames[i]}",${filename}`);
        } catch (error) {
            console.error(`Error processing image ${i + 1}:`, error.message);
        }
    }

    // Add CSV file to archive
    archive.append(csvRows.join('\n'), { name: 'products.csv' });

    // Finalize the archive
    await archive.finalize();
});

// Start crawler endpoint
app.post('/api/crawl', async (req, res) => {
    const { shopUrl, maxPages } = req.body;
    
    try {
        const crawler = require('./index.js');
        const results = await crawler.start(shopUrl, maxPages, (currentPage, totalPages) => {
            if (global.progressRes) {
                global.progressRes.write(`data: ${JSON.stringify({ currentPage, totalPages })}\n\n`);
            }
        });
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 