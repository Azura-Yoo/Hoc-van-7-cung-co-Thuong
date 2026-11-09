import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];

if (inlineScripts.length === 0) {
  throw new Error("Không tìm thấy script nội tuyến trong index.html.");
}

inlineScripts.forEach((match, index) => {
  new vm.Script(match[1], { filename: \`index.html:inline-script-\${index + 1}\` });
});

const required = [
  'id="publicLanding"',
  'id="platformAdminPanel"',
  'data-grade-entry="7"',
  'teacher_spaces',
  'studentGrade!==activeGrade',
  'action:"create_teacher"'
];

for (const item of required) {
  if (!html.includes(item)) throw new Error(\`Thiếu thành phần bắt buộc: \${item}\`);
}

console.log(\`OK: đã phân tích cú pháp \${inlineScripts.length} script và kiểm tra các điểm phân quyền cốt lõi.\`);
