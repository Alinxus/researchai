import { NextApiRequest, NextApiResponse } from 'next';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import PDFDocument from 'pdfkit';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

interface ScrapedData {
  companyName: string;
  productNames: string[];
  productDescriptions: string[];
  pricing: string[];
  contactInfo: string;
  socialMediaLinks: string[];
  newsHeadlines: string[];
  keyFeatures: string[];
  images: any[];
}

interface ImageData {
  url: string;
  localPath: string;
  analysis: ImageAnalysis;
}

interface ImageAnalysis {
  labels: string[];
  text: string;
  logoDetection: string[];
  colorInfo: string;
}

// Initialize Google Cloud Vision client (example placeholder, adjust as needed)

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const scrapedData: ScrapedData = {
    companyName: '',
    productNames: [],
    productDescriptions: [],
    pricing: [],
    contactInfo: '',
    socialMediaLinks: [],
    newsHeadlines: [],
    keyFeatures: [],
    images: []
  };

  // Extract company name (usually in the header or footer)
  scrapedData.companyName = $('header h1, footer .company-name').first().text().trim();

  // Extract product names and descriptions
  $('.product, .product-item').each((i, elem) => {
    const productName = $(elem).find('.product-name, .product-title').text().trim();
    const productDesc = $(elem).find('.product-description, .product-desc').text().trim();
    if (productName) scrapedData.productNames.push(productName);
    if (productDesc) scrapedData.productDescriptions.push(productDesc);
  });

  // Extract pricing information
  $('.price, .pricing').each((i, elem) => {
    const price = $(elem).text().trim();
    if (price) scrapedData.pricing.push(price);
  });

  // Extract contact information
  scrapedData.contactInfo = $('.contact-info, .contact-us').text().trim();

  // Extract social media links
  $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]').each((i, elem) => {
    const link = $(elem).attr('href');
    if (link) scrapedData.socialMediaLinks.push(link);
  });

  // Extract news headlines
  $('.news-item h3, .press-release h2').each((i, elem) => {
    const headline = $(elem).text().trim();
    if (headline) scrapedData.newsHeadlines.push(headline);
  });

  // Extract key features or benefits
  $('.feature, .benefit, .key-point').each((i, elem) => {
    const feature = $(elem).text().trim();
    if (feature) scrapedData.keyFeatures.push(feature);
  });

  return scrapedData;
}

const redis = new Redis(process.env.REDIS_URL as string);

export async function generateAIAnalysis(data: ScrapedData[], sections: string[], format: string): Promise<string> {
  const prompt = `Analyze the following competitive intelligence data and generate a ${format} report including only the following sections: ${sections.join(', ')}. 
  
  ${data.map(competitor => `
    Company: ${competitor.companyName}
    Products: ${competitor.productNames.join(', ')}
    Product Descriptions: ${competitor.productDescriptions.join(' | ')}
    Pricing: ${competitor.pricing.join(', ')}
    Contact Info: ${competitor.contactInfo}
    Social Media: ${competitor.socialMediaLinks.join(', ')}
    Recent News: ${competitor.newsHeadlines.join(' | ')}
    Key Features: ${competitor.keyFeatures.join(', ')}
    Image Analysis: ${competitor.images.map(image  => `
      Labels: ${image.analysis.labels.join(', ')}
      Text detected: ${image.analysis.text}
      Logos detected: ${image.analysis.logoDetection.join(', ')}
      Dominant colors: ${image.analysis.colorInfo}
    `).join('\n')}
  `).join('\n\n')}

  The report should be ${format === 'detailed' ? 'comprehensive and in-depth' : format === 'summary' ? 'concise and to-the-point' : 'formatted in bullet points suitable for a presentation'}.
  Focus on the most important insights and actionable information.`;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const response = await openai.chat.completions.create({
    model: "text-davinci-002",
    messages:  [{ role: "user", content: `${prompt}` }]
  });

  return response.choices[0]?.message?.content || '';
}

export async function generatePDF(analysisResult: string, sections: string[], format: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: any[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Helper function to add a new page if needed
    const ensureSpace = (neededSpace: number) => {
      if (doc.y + neededSpace > doc.page.height - 50) {
        doc.addPage();
      }
    };

    // Title
    doc.fontSize(24).text('Competitive Intelligence Report', { align: 'center' });
    doc.moveDown();

    // Table of Contents
    if (format !== 'presentation') {
      doc.fontSize(18).text('Table of Contents');
      doc.moveDown(0.5);
      sections.forEach((section, index) => {
        doc.fontSize(12).text(section, { link: `#section${index + 1}` });
      });
      doc.moveDown();
    }

    // Content
    const contentLines = analysisResult.split('\n');
    let currentSection = '';
    contentLines.forEach((line) => {
      if (sections.some(section => line.includes(section))) {
        ensureSpace(100);
        currentSection = line;
        doc.fontSize(18).text(line, { destination: `section${sections.findIndex(s => s.includes(line)) + 1}` });
        doc.moveDown();
      } else {
        ensureSpace(20);
        if (format === 'presentation') {
          doc.fontSize(14).text(`• ${line}`);
        } else {
          doc.fontSize(12).text(line);
        }
      }
    });

    // Ensure minimum of 15 pages for detailed reports
    if (format === 'detailed') {
      while (doc.bufferedPageRange().count < 15) {
        doc.addPage();
      }
    }

    // Add page numbers
    let pages = doc.bufferedPageRange().count;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);
      doc.fontSize(10).text(`Page ${i + 1} of ${pages}`, 50, doc.page.height - 50, { align: 'center' });
    }

    doc.end();
  });
}

async function getCachedData(key: string): Promise<string | null> {
  return redis.get(key);
}

async function setCachedData(key: string, value: string, expirationInSeconds: number): Promise<void> {
  await redis.set(key, value, 'EX', expirationInSeconds);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { competitors, reportSections, reportFormat } = req.body;
      const progressStream = new Readable({ read() {} });

      // Set up SSE for progress updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const sendProgress = (message: string) => {
        progressStream.push(`data: ${JSON.stringify({ message })}\n\n`);
      };

      progressStream.pipe(res);

      sendProgress('Starting report generation...');

      // Collect real-time data for each competitor
      const competitorData = await Promise.all(
        competitors.map(async (competitor: string, index: number) => {
          sendProgress(`Analyzing competitor ${index + 1} of ${competitors.length}...`);
          const cacheKey = `competitor:${competitor}`;
          const cachedData = await getCachedData(cacheKey);

          if (cachedData) {
            sendProgress(`Using cached data for ${competitor}...`);
            return JSON.parse(cachedData);
          } else {
            const scrapedData = await scrapeWebsite(`https://www.${competitor}.com`);
            await setCachedData(cacheKey, JSON.stringify(scrapedData), 86400); // Cache for 24 hours
            return scrapedData;
          }
        })
      );

      sendProgress('Generating AI analysis...');
      const analysisResult = await generateAIAnalysis(competitorData, reportSections, reportFormat);

      sendProgress('Creating PDF report...');
      const pdfBuffer = await generatePDF(analysisResult, reportSections, reportFormat);

      sendProgress('Report generation complete!');
      progressStream.push(null); // End the stream

      // Send the PDF as an attachment
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=competitive_intelligence_report.pdf',
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ error: 'An error occurred while generating the report' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
