const assert = require('assert');
const { enrichCompanyResult } = require('./dist/index');

(async () => {
  try {
    const enriched = await enrichCompanyResult({
      companyName: 'Example Company',
      companyUrl: 'https://example.com',
      detectedServices: ['Old Service'],
      technologies: ['Old Tech'],
    });

    assert.ok(Array.isArray(enriched.detectedServices), 'detectedServices should be an array');
    assert.ok(Array.isArray(enriched.technologies), 'technologies should be an array');
    console.log('test passed');
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
})();
