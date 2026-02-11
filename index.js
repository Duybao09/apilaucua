const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

/*===========================
CONFIG
===========================*/

const API_TX = "https://wtx.tele68.com/v1/tx/sessions";
const API_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";
const MAX_HISTORY = 50;

let modelPredictions = {};

/*===========================
FETCH HISTORY
===========================*/

async function fetchHistory(apiUrl) {

    const response = await axios.get(apiUrl);

    const list = response.data.list || [];

    const latest50 = list.slice(0, MAX_HISTORY);

    const history = latest50.map(item => ({

        session: item.id,

        result: item.resultTruyenThong === "TAI" ? "Tài" : "Xỉu",

        totalScore: item.point,

        dices: item.dices,

        point: item.point,

        rawResult: item.resultTruyenThong

    }));

    return history.reverse(); // đảo để cũ → mới cho thuật toán
}

/*===========================
BUILD PATTERN STRING
===========================*/

function buildPattern(history){

    return history.map(h=> h.result==="Tài" ? "T" : "X").join("");

}

/*===========================
ALGORITHM (GIỮ NGUYÊN)
===========================*/

function detectStreakAndBreak(history) {

  if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };

  let streak = 1;

  const currentResult = history[history.length - 1].result;

  for (let i = history.length - 2; i >= 0; i--) {

    if (history[i].result === currentResult) {

      streak++;

    } else {

      break;

    }

  }

  const last15 = history.slice(-15).map(h => h.result);

  if (!last15.length) return { streak, currentResult, breakProb: 0.0 };

  const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);

  const taiCount = last15.filter(r => r === 'Tài').length;

  const xiuCount = last15.filter(r => r === 'Xỉu').length;

  const imbalance = Math.abs(taiCount - xiuCount) / last15.length;

  let breakProb = 0.0;

  if (streak >= 8) {

    breakProb = Math.min(0.6 + (switches / 15) + imbalance * 0.15, 0.9);

  } else if (streak >= 5) {

    breakProb = Math.min(0.35 + (switches / 10) + imbalance * 0.25, 0.85);

  } else if (streak >= 3 && switches >= 7) {

    breakProb = 0.3;

  }

  return { streak, currentResult, breakProb };

}

/* ===========================
AI HTDD Logic (giữ nguyên)
=========================== */

function aiHtddLogic(history) {

  if (!history || history.length < 3) {

    return { prediction: Math.random()<0.5?"Tài":"Xỉu" };

  }

  const recentHistory = history.slice(-5).map(h => h.result);

  const taiCount = recentHistory.filter(r => r === 'Tài').length;

  const xiuCount = recentHistory.filter(r => r === 'Xỉu').length;

  if (taiCount > xiuCount) return { prediction: "Xỉu" };

  if (xiuCount > taiCount) return { prediction: "Tài" };

  return { prediction: Math.random()<0.5?"Tài":"Xỉu" };

}

/*===========================
MAIN PREDICT
===========================*/

function generatePrediction(history) {

    const aiPred = aiHtddLogic(history);

    return aiPred.prediction;

}

/*===========================
FORMAT HISTORY OUTPUT
===========================*/

function formatHistoryOutput(history){

    const newest = history[history.length-1];

    return history.slice().reverse().map(h=>({

        Phien: h.session,

        Xuc_xac_1: h.dices[0],

        Xuc_xac_2: h.dices[1],

        Xuc_xac_3: h.dices[2],

        Tong: h.point,

        Ket_qua: h.result,

        id:"cskh_huydaixu"

    }));

}

/*===========================
FORMAT PREDICT OUTPUT
===========================*/

function formatPredictOutput(history){

    const newest = history[history.length-1];

    const pattern = buildPattern(history);

    const prediction = generatePrediction(history);

    return [{

        Phien: newest.session,

        Xuc_xac_1: newest.dices[0],

        Xuc_xac_2: newest.dices[1],

        Xuc_xac_3: newest.dices[2],

        Tong: newest.point,

        Ket_qua: newest.result,

        Pattern: pattern,

        Phien_hien_tai: newest.session + 1,

        Du_doan: prediction,

        id:"cskh_huydaixu"

    }];

}

/*===========================
API HISTORY
===========================*/

app.get("/history/taixiu", async (req,res)=>{

    const history = await fetchHistory(API_TX);

    res.send(JSON.stringify(formatHistoryOutput(history)));

});

app.get("/history/taixiumd5", async (req,res)=>{

    const history = await fetchHistory(API_MD5);

    res.send(JSON.stringify(formatHistoryOutput(history)));

});

/*===========================
API PREDICT
===========================*/

app.get("/predict/taixiu", async (req,res)=>{

    const history = await fetchHistory(API_TX);

    res.send(JSON.stringify(formatPredictOutput(history)));

});

app.get("/predict/taixiumd5", async (req,res)=>{

    const history = await fetchHistory(API_MD5);

    res.send(JSON.stringify(formatPredictOutput(history)));

});

/*===========================
START SERVER
===========================*/

app.listen(PORT,()=>{

    console.log("Server running http://localhost:"+PORT);

});
