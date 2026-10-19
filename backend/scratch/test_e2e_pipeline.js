const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const ScanService = require('../src/services/scan.service');
const Scan = require('../src/models/Scan');
const Finding = require('../src/models/Finding');

(async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    const ORG_ID = '6a93cad7702a658f4ce2ddf5';
    const INSTALLATION_ID = '158526082';
    const OWNER = 'gauravGunjal14';
    const REPO = 'Orion';

    // Enqueue a new scan
    const { scanId, jobId, status } = await ScanService.enqueueScan({
      organizationId: ORG_ID,
      owner: OWNER,
      repo: REPO,
      installationId: INSTALLATION_ID,
    });
    console.log('📤 Scan enqueued', { scanId: scanId.toString(), jobId, status });

    // Poll for completion (max 5 minutes)
    let scan = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      scan = await Scan.findById(scanId);
      console.log(`⏳ Poll ${i + 1}: status=${scan.status}`);
      if (scan.status === 'completed' || scan.status === 'failed') break;
    }

    if (!scan) throw new Error('Scan not found after polling');
    console.log('🔚 Final scan status', {
      status: scan.status,
      scannersUsed: scan.scannersUsed,
      summary: scan.summary,
      errorMessage: scan.errorMessage,
    });

    const findings = await Finding.find({ scan: scanId }).sort({ riskScore: -1 }).lean();
    console.log(`📊 Total findings: ${findings.length}`);
    findings.forEach(f => {
      console.log({
        scanner: f.scanner,
        ruleId: f.ruleId,
        title: f.title,
        cwe: f.cwe,
        severity: f.severity,
        filePath: f.filePath,
        startLine: f.startLine,
        fingerprint: f.fingerprint,
        riskScore: f.riskScore,
        riskCategory: f.riskCategory,
        riskFactors: f.riskFactors,
      });
    });

    const banditFindings = findings.filter(f => f.scanner === 'bandit');
    console.log(`🔎 Bandit findings count: ${banditFindings.length}`);
    const cwe78 = banditFindings.filter(f => f.cwe && f.cwe.includes('78'));
    console.log(`💥 CWE-78 Bandit findings: ${cwe78.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Pipeline test failed', err);
    process.exit(1);
  }
})();
