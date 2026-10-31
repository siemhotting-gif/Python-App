// Build the two versions of the app from src/app.html (the full app, keep this file private):
//   docs/index.html  free public page: Module 2 only + login, sign-up and payment (src/free-auth.js)
//   dist/app.html    full app, served by the backend only to logged-in users who paid
// Usage:  npm install   (once)   then   node build.mjs
// With SUPABASE_SERVICE_ROLE_KEY set, it also uploads dist/app.html to Supabase Storage (bucket "app").
import { parse } from "acorn";
import fs from "fs";

const cfg = JSON.parse(fs.readFileSync(process.env.CONFIG || "config.json", "utf8"));
const full = fs.readFileSync("src/app.html", "utf8");
const FIRST_LOCKED = 6; // topic ids 0-5 are Module 2 (free); 6 and up are Modules 3-5

const s0 = full.indexOf("<script>") + 8, s1 = full.lastIndexOf("</script>");
let js = full.slice(s0, s1);

// 1. Swap the auth block for the free-page version.
const a0 = js.indexOf("// ==== AUTH START"), a1 = js.indexOf("// ==== AUTH END ====");
if (a0 < 0 || a1 < 0) throw new Error("AUTH START/END markers not found in src/app.html");
const freeAuth = fs.readFileSync("src/free-auth.js", "utf8").replace("__CONFIG__", JSON.stringify({
  supabaseUrl: cfg.supabaseUrl, supabaseAnonKey: cfg.supabaseAnonKey, priceLabel: cfg.priceLabel,
}));
js = js.slice(0, a0) + freeAuth + js.slice(a1 + "// ==== AUTH END ====".length);

// 2. Remove all Module 3-5 content, keeping array positions so topic ids still line up.
const ast = parse(js, { ecmaVersion: "latest" });
const edits = []; // [start, end, text]
const src = n => js.slice(n.start, n.end);
const num = n => n && n.type === "Literal" && typeof n.value === "number" ? n.value : null;
const keyNum = p => parseInt(p.key.type === "Literal" ? String(p.key.value) : p.key.name, 10);
const setElements = (arr, list) => edits.push([arr.start, arr.end, "[" + list.join(",") + "]"]);
const setAll = (node, text) => edits.push([node.start, node.end, text]);

const LESSON = '["",[],[]]';
const perTopic = { G: "[]", X: "[]", Y: "[]", LES: LESSON, REFD: '""' };
const allOf = { G5: "[]", G6: "[]", OOPLES: LESSON, OOPREF: '""', OOP2REF: '""' };
const emptyArr = ["OOPOPEN", "OOP2OPEN", "OOPEXAM", "OOP2EXAM"];
const emptyObj = ["OOPNBX", "OOP2NBX", "OOP2REFX"];
const done = new Set();

for (const st of ast.body) {
  // G.push([...])  adds the "Files" topic (Module 4)
  if (st.type === "ExpressionStatement" && st.expression.type === "CallExpression" && src(st.expression.callee) === "G.push") {
    for (const arg of st.expression.arguments) if (arg.type === "ArrayExpression") setElements(arg, []);
    done.add("G.push");
  }
  if (st.type !== "VariableDeclaration") continue;
  for (const d of st.declarations) {
    const name = d.id.name, init = d.init;
    if (!init) continue;
    if (perTopic[name]) setElements(init, init.elements.map((e, i) => i < FIRST_LOCKED ? src(e) : perTopic[name]));
    else if (allOf[name]) setElements(init, init.elements.map(() => allOf[name]));
    else if (emptyArr.includes(name)) setAll(init, "[]");
    else if (emptyObj.includes(name)) setAll(init, "{}");
    else if (name === "OPEN") setElements(init, init.elements.filter(e => num(e.elements[0]) < FIRST_LOCKED).map(src));
    else if (name === "EXAM") setElements(init, init.elements.filter(e => num(e.elements[0]) === 2).map(src));
    else if (name === "NBX" || name === "EXTRA")
      setAll(init, "{" + init.properties.filter(p => keyNum(p) < FIRST_LOCKED).map(src).join(",") + "}");
    else if (name === "G6X") setAll(init, "{" + init.properties.map(p => src(p.key) + ":[]").join(",") + "}");
    else if (name === "OOP2LES") {
      const les = init.properties.find(p => (p.key.value ?? p.key.name) === "les");
      setAll(init, `{"les":[${les.value.elements.map(() => LESSON).join(",")}],"extra":{}}`);
    } else continue;
    done.add(name);
  }
}
const expected = [...Object.keys(perTopic), ...Object.keys(allOf), ...emptyArr, ...emptyObj, "OPEN", "EXAM", "NBX", "EXTRA", "G6X", "OOP2LES", "G.push"];
const missing = expected.filter(n => !done.has(n));
if (missing.length) throw new Error("Not found in src/app.html (check the build before publishing!): " + missing.join(", "));

edits.sort((x, y) => y[0] - x[0]);
for (const [a, b, t] of edits) js = js.slice(0, a) + t + js.slice(b);
parse(js, { ecmaVersion: "latest" }); // fails loudly if the free page is no longer valid JavaScript

const sbScript = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n';
const head = full.slice(0, s0 - 8).replace("</head>", sbScript + "</head>");
fs.mkdirSync("docs", { recursive: true });
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("docs/index.html", head + "<script>" + js + full.slice(s1));
fs.writeFileSync("dist/app.html", full);
console.log(`docs/index.html  ${(fs.statSync("docs/index.html").size / 1024).toFixed(0)} KB (free, public)`);
console.log(`dist/app.html    ${(fs.statSync("dist/app.html").size / 1024).toFixed(0)} KB (full, private)`);

// 3. Optional: upload the full app to Supabase Storage.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (key) {
  const r = await fetch(`${cfg.supabaseUrl}/storage/v1/object/app/app.html`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "text/html; charset=utf-8", "x-upsert": "true" },
    body: full,
  });
  console.log(r.ok ? "Uploaded dist/app.html to Supabase Storage (bucket app)." : `Upload failed: ${r.status} ${await r.text()}`);
} else console.log("Not uploaded: set SUPABASE_SERVICE_ROLE_KEY to upload dist/app.html, or upload it by hand (see SETUP.md).");
