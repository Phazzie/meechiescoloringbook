const fs = require('fs');

const filePath = 'src/routes/+page.svelte';
let content = fs.readFileSync(filePath, 'utf8');

// wait, double checking saveDraft vs generateDraft -> it's "saveDraft"
// and "saveToVault"
