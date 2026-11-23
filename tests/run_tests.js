#!/usr/bin/env node
/**
 * vision-calc 选型计算器 · 标准用例回归测试
 * 用法: node tests/run_tests.js [path/to/index.html]
 * 原理: 从 index.html 抽取 <script> 代码，用 DOM 桩(stub)执行，
 *       驱动 compute() 并核对输出与独立重算的期望值。
 */
const fs = require("fs");
const path = require("path");

const htmlPath = process.argv[2] || path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("未找到 <script> 块"); process.exit(1); }
const script = m[1];

// ---------- DOM 桩 ----------
function makeEl(id) {
  return {
    id, value: "", textContent: "", innerHTML: "", checked: false,
    addEventListener: () => {}, style: {}, dataset: {},
    getContext: () => ({
      fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
      fillText(){}, set fillStyle(v){}, get fillStyle(){return ""},
      set strokeStyle(v){}, set lineWidth(v){}, set font(v){}
    }),
    width: 640, height: 480
  };
}
const els = {};
const DEFAULTS = { fov:"40", prec:"0.15", mode:"defect", cov:"4", sensor:"2/3",
  wd:"160", fn:"8", dh:"0.2", wl:"550", bWd:"110", bFn:"4", bSensor:"2/3" };
const stub$ = id => (els[id] = els[id] || makeEl(id));
Object.keys(DEFAULTS).forEach(k => { stub$(k).value = DEFAULTS[k]; });

const sandbox = {
  document: {
    getElementById: stub$,
    querySelectorAll: () => [],
    body: {},
    createElement: () => ({ select(){}, set value(v){}, }),
    execCommand: () => true
  },
  navigator: {},
  URLSearchParams,
  location: { hash: "" },
  history: { replaceState: (a, b, url) => { sandbox.location.hash = url || ""; } },
  getComputedStyle: () => ({ getPropertyValue: () => "#e8e6df" }),
  console, Math, isFinite, setTimeout
};
sandbox.window = sandbox;
const vm = require("vm");
vm.createContext(sandbox);
vm.runInContext(script, sandbox);

// ---------- 独立重算（与页面代码分开实现的公式） ----------
const SENSORS = {
  "1/2.3":[6.17,4.55], "1/1.8":[7.18,5.32], "2/3":[8.8,6.6],
  "1":[12.8,9.6], "1.1":[14.1,10.3], "4/3":[17.3,13.0]
};
const CAMERAS = [
  [640,480],[1280,1024],[1600,1200],[2048,1536],[2592,1944],[3072,2048],
  [3264,2448],[3840,2748],[4096,3000],[5472,3648],[5120,5120]
];
const FOCALS = [6,8,12,16,25,35,50,75,100];
const nearest = (arr, x) => arr.reduce((a,b)=> Math.abs(b-x)<Math.abs(a-x)?b:a);
function expect(inp) {
  const [sw, sh] = SENSORS[inp.sensor];
  const pixel = inp.mode === "defect" ? inp.prec / inp.cov : inp.prec;
  const fovH = inp.fov * sh / sw;
  const pxW = inp.fov / pixel, pxH = fovH / pixel;
  const camIdx = CAMERAS.findIndex(([w,h]) => w >= pxW && h >= pxH);
  const cam = camIdx >= 0 ? camIdx : CAMERAS.length - 1;
  const camW = CAMERAS[cam][0], camH = CAMERAS[cam][1];
  const pixReal = inp.fov / CAMERAS[cam][0];
  const beta = sw / inp.fov;
  const fIdeal = inp.wd * sw / inp.fov;
  const fStd = nearest(FOCALS, fIdeal);
  const wdReal = fStd * inp.fov / sw;
  const lpmm = 1 / (2 * pixel);
  const dof = 2 * (2 * pixReal) * inp.fn * (1 + beta) / (beta * beta);
  const persp = inp.dh / inp.wd;
  const perspErr = inp.fov * persp;
  return { pixel, pxW, pxH, camIdx: cam, camW, camH, pixReal, beta, fIdeal, fStd, wdReal, lpmm, dof, persp, perspErr };
}
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// ---------- 用例 ----------
// mode: defect=精度口径为最小缺陷尺寸; pixel=单像素直接给出
const CASES = [
  // 1) README/页面默认场景：瓶盖外观
  {name:"瓶盖外观(默认)", inp:{fov:40,prec:0.15,mode:"defect",cov:4,sensor:"2/3",wd:160,fn:8,dh:0.2}},
  // 2) PCB 焊点：高精度
  {name:"PCB焊点", inp:{fov:30,prec:0.03,mode:"defect",cov:4,sensor:"2/3",wd:120,fn:8,dh:0.1}},
  // 3) 手机屏幕：大视野
  {name:"手机屏幕", inp:{fov:150,prec:0.05,mode:"defect",cov:4,sensor:"1.1",wd:300,fn:8,dh:0.2}},
  // 4) 药品包装
  {name:"药品包装", inp:{fov:60,prec:0.20,mode:"defect",cov:4,sensor:"2/3",wd:200,fn:8,dh:0.3}},
  // 5) 已知答案: FOV=100mm, 1"靶面, WD=100 → f理想12.8 → 标准取12mm
  {name:"教科书案例", inp:{fov:100,prec:0.1,mode:"pixel",cov:4,sensor:"1",wd:100,fn:4,dh:0}},
  // 6) 远心触发：Δh 大到透视误差超过精度
  {name:"透视超标(远心)", inp:{fov:40,prec:0.05,mode:"defect",cov:4,sensor:"2/3",wd:100,fn:8,dh:1.0}},
  // 7) 景深不足：β 大 + F 小
  {name:"景深不足", inp:{fov:20,prec:0.02,mode:"pixel",cov:4,sensor:"1",wd:65,fn:2,dh:2}},
  // 8) 红外大靶面
  {name:"大靶面4/3", inp:{fov:200,prec:0.2,mode:"pixel",cov:4,sensor:"4/3",wd:500,fn:11,dh:1}},
  // 9) 极小视野
  {name:"微小视野", inp:{fov:5,prec:0.005,mode:"pixel",cov:4,sensor:"1/1.8",wd:65,fn:8,dh:0.05}},
  // 10) 单像素口径
  {name:"单像素口径", inp:{fov:80,prec:0.02,mode:"pixel",cov:4,sensor:"2/3",wd:220,fn:5.6,dh:0.4}},
  // 11) 覆盖像素=2
  {name:"覆盖2px", inp:{fov:40,prec:0.15,mode:"defect",cov:2,sensor:"2/3",wd:160,fn:8,dh:0.2}},
  // 12) 覆盖像素=5
  {name:"覆盖5px", inp:{fov:40,prec:0.15,mode:"defect",cov:5,sensor:"2/3",wd:160,fn:8,dh:0.2}},
  // 13) 小F数景深
  {name:"F1.4景深", inp:{fov:40,prec:0.15,mode:"defect",cov:4,sensor:"2/3",wd:160,fn:1.4,dh:0.2}},
  // 14) 长工作距离
  {name:"长WD=500", inp:{fov:150,prec:0.1,mode:"defect",cov:4,sensor:"1",wd:500,fn:8,dh:0.5}},
  // 15) 超短WD
  {name:"短WD=50", inp:{fov:40,prec:0.1,mode:"defect",cov:4,sensor:"2/3",wd:50,fn:8,dh:0.1}},
  // 16) 1/2.3" 小靶面
  {name:"小靶面1/2.3", inp:{fov:60,prec:0.15,mode:"defect",cov:4,sensor:"1/2.3",wd:200,fn:8,dh:0.2}},
  // 17) 1/1.8 靶面
  {name:"靶面1/1.8", inp:{fov:45,prec:0.08,mode:"defect",cov:3,sensor:"1/1.8",wd:150,fn:5.6,dh:0.15}},
  // 18) 超高精度触发最大相机档
  {name:"超高精度", inp:{fov:100,prec:0.005,mode:"pixel",cov:4,sensor:"4/3",wd:300,fn:8,dh:0.1}},
  // 19) 高度波动=0（远心边界安全侧）
  {name:"无高度波动", inp:{fov:40,prec:0.05,mode:"pixel",cov:4,sensor:"2/3",wd:100,fn:8,dh:0}},
  // 20) 大F数深景深
  {name:"F16深景深", inp:{fov:80,prec:0.05,mode:"pixel",cov:4,sensor:"1",wd:200,fn:16,dh:1.5}},
];

let pass = 0, fail = 0;
const t0 = process.hrtime.bigint();
for (const c of CASES) {
  Object.assign(stub$("fov"), {value: String(c.inp.fov)});
  stub$("prec").value = String(c.inp.prec);
  stub$("mode").value = c.inp.mode;
  stub$("cov").value = String(c.inp.cov);
  stub$("sensor").value = c.inp.sensor;
  stub$("wd").value = String(c.inp.wd);
  stub$("fn").value = String(c.inp.fn);
  stub$("dh").value = String(c.inp.dh);
  vm.runInContext("compute()", sandbox);
  const e = expect(c.inp);
  const gotRes = els["rRes"].textContent;             // "WxH"
  const gotFocal = els["rFocal"].textContent;         // "12 mm"
  const gotCam = els["rCam"].textContent;
  const errs = [];
  // 分辨率
  const expRes = Math.ceil(e.pxW) + "×" + Math.ceil(e.pxH);
  if (gotRes !== expRes) errs.push(`分辨率 ${gotRes} != ${expRes}`);
  // 焦距
  const expFocal = e.fStd + " mm";
  if (gotFocal !== expFocal) errs.push(`焦距 ${gotFocal} != ${expFocal}`);
  // 相机档位（rCamSub "1280×1024 像元"）
  const expCam = e.camW + "×" + e.camH + " 像元";
  if (els["rCamSub"].textContent !== expCam) errs.push(`相机 ${els["rCamSub"].textContent} != ${expCam}`);
  // 放大率（页面显示 3 位小数）
  if (els["rBeta"].textContent !== e.beta.toFixed(3)) errs.push(`β ${els["rBeta"].textContent} != ${e.beta.toFixed(3)}`);
  // 景深（页面显示 1 位小数）
  if (els["rDof"].textContent !== e.dof.toFixed(1) + " mm") errs.push(`DOF ${els["rDof"].textContent} != ${e.dof.toFixed(1)} mm`);
  if (errs.length) { fail++; console.log(`✗ ${c.name}: ${errs.join("; ")}`); }
  else { pass++; console.log(`✓ ${c.name}  [${gotRes} / ${gotCam} / ${gotFocal}]`); }
}
const t1 = process.hrtime.bigint();

// ---------- 延迟基准：单次 compute 平均耗时 ----------
stub$("fov").value = "40"; stub$("prec").value = "0.15";
vm.runInContext("compute()", sandbox);
const N = 3000;
const L0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) vm.runInContext("compute()", sandbox);
const L1 = process.hrtime.bigint();
const avgMs = Number(L1 - L0) / 1e6 / N;

// ---------- B 版新功能检查 ----------
let bPass = 0, bTotal = 0, bNotes = [];
function bCheck(name, ok, note){ bTotal++; if(ok) bPass++; else bNotes.push(name+": "+note); }

// 1) 衍射极限校验输出
bCheck("衍射极限校验", /上限\s*[\d.]+\s*lp\/mm/.test(els["rDiff"] ? els["rDiff"].innerHTML : ""),
  els["rDiff"] ? els["rDiff"].innerHTML : "无 rDiff 节点");
// 2) 纯函数 calc 可独立调用（教科书案例：1"靶面 FOV100 WD100 → f=12）
{
  const o = vm.runInContext(
    "calc({fov:100, prec:0.1, mode:'pixel', cov:4, sensor:'1', wd:100, fn:4, dh:0, wl:550})",
    sandbox);
  bCheck("calc纯函数", o.fStd === 12 && o.cam.name === "130万", "fStd="+o.fStd);
}
// 3) 双方案对照面板（先恢复默认输入，避免用例20残留）
{
  Object.keys(DEFAULTS).forEach(k => { stub$(k).value = DEFAULTS[k]; });
  stub$("bEn").checked = true;
  stub$("bWd").value = "110"; stub$("bFn").value = "4"; stub$("bSensor").value = "1";
  vm.runInContext("compute()", sandbox);
  const panelShown = vm.runInContext('document.getElementById("cmpPanel").style.display', sandbox) === "";
  const hasVerdict = /建议选方案|均有不达标项/.test(els["cmpVerdict"].innerHTML);
  bCheck("双方案对照", panelShown && hasVerdict, `display=${vm.runInContext('document.getElementById("cmpPanel").style.display', sandbox)} verdict=${els["cmpVerdict"].innerHTML.slice(0,40)}`);
  els["cmpVerdictSaved"] = els["cmpVerdict"].innerHTML;
  stub$("bEn").checked = false;
  vm.runInContext("compute()", sandbox);
}
// 4) URL 参数复现
{
  const h = vm.runInContext("location.hash", sandbox);
  bCheck("URL参数复现", /f=40/.test(h) && /p=0.15/.test(h), "hash="+h);
}
// 5) 选型报告导出（含边界声明）
{
  const rep = vm.runInContext(
    "buildReport(readInputs(), calc(readInputs()))", sandbox);
  bCheck("报告导出", rep.includes("【机器视觉选型报告】") && rep.includes("边界声明"), rep.slice(0,60));
}
// 6) 衍射物理正确性：需求超过截止时必须报警（IR 850nm + 小F + 高精度）
{
  stub$("wl").value = "850"; stub$("fn").value = "16";
  stub$("fov").value = "40"; stub$("prec").value = "0.01"; stub$("mode").value = "pixel";
  vm.runInContext("compute()", sandbox);
  bCheck("衍射不足报警", /不足|临界/.test(els["rDiff"].innerHTML), els["rDiff"].innerHTML.slice(0,50));
  stub$("wl").value = "550"; stub$("fn").value = "8";
  stub$("prec").value = "0.15"; stub$("mode").value = "defect";
  vm.runInContext("compute()", sandbox);
}

console.log("\n========== 基线/版本测试报告 ==========");
console.log(`用例通过: ${pass}/${CASES.length}`);
console.log(`B版新功能: ${bPass}/${bTotal}${bNotes.length ? "  失败项: " + bNotes.join("; ") : ""}`);
console.log(`单次重算延迟: ${avgMs.toFixed(3)} ms (n=${N})`);
console.log(`依赖: 0（纯单文件） · 文件: 1 个 index.html`);
// 功能维度探测
const dims = ["rPix","rPixReal","rBeta","rFovH","rLpmm","rDof","rPersp","rPerspChk"]
  .filter(id => els[id] && els[id].textContent && els[id].textContent !== "—").length;
console.log(`指标输出行数: ${dims}/8`);
console.log(`衍射极限校验: ${els["rDiff"] && els["rDiff"].innerHTML ? "有" : "无"}`);
console.log(`双方案对比: ${els["cmpVerdictSaved"] ? "有（"+els["cmpVerdictSaved"].replace(/<[^>]+>/g,"").slice(0,30)+"）" : "无"}`);
console.log(`URL参数复现: ${/f=40/.test(vm.runInContext("location.hash", sandbox)) ? "有" : "无"}`);
process.exit(fail ? 1 : 0);
