import fs from 'fs';
const file = 'probes/provider-adapter.probe.mjs';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
	/} catch \(error\) {\n\t\tif \(error && error\.code !== 'ENOENT'\) {\n\t\t\tthrow error;\n\t\t}\n\t}/g,
	"} catch (error) {\n\t\tif (error && error.code !== 'ENOENT') {\n\t\t\tthrow error;\n\t\t}\n\t}"
);
content = content.replace(
	/} catch \(error\) {\n\t\treturn { ok: false, value: null, raw: text };\n\t}/g,
	'} catch {\n\t\treturn { ok: false, value: null, raw: text };\n\t}'
);
fs.writeFileSync(file, content);
