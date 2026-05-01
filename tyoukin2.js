// ==UserScript==
// @name         ★超勤：タイムカード＆実績終了＆休憩チェック（完成版）
// @namespace    http://tampermonkey.net/
// @version      2.3
// @match        https://midorinet-iwate.cybozu.com/o/ag.cgi?page=DBForm&did=150*
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    const fldTotal = document.querySelector("#dz_fld505");

    const sh = document.querySelector('select[name="5135.Hour"]');
    const sm = document.querySelector('select[name="5135.Minute"]');
    const eh = document.querySelector('select[name="5136.Hour"]');
    const em = document.querySelector('select[name="5136.Minute"]');

const isTimeCard = location.href.includes("TimeCardIndex");
/********** ② 勤務時間（完全安定版・日付完全一致） **********/
const btnTime = document.createElement("button");
btnTime.textContent = " タイムカードアプリからタイムカード出勤・退勤に貼付け　　";
styleBtn(btnTime, "360px", "#FF9800");

btnTime.onclick = async () => {

    try {

        const sh = document.querySelector('select[name="5135.Hour"]');
        const sm = document.querySelector('select[name="5135.Minute"]');
        const eh = document.querySelector('select[name="5136.Hour"]');
        const em = document.querySelector('select[name="5136.Minute"]');

        if (!sh || !sm || !eh || !em) {
            alert("出退勤フィールドが見つかりません");
            return;
        }

        const month = parseInt(document.querySelector('select[name="506.Month"]')?.value);
        const day   = parseInt(document.querySelector('select[name="506.Day"]')?.value);
        // ===== 現在月チェック（追加） =====
        const nowMonth = new Date().getMonth() + 1; // 0始まりなので+1

        if (nowMonth !== month) {
            alert(`月が一致しません（取得は当月のみ）\n命令月=${month}月　現在月=${nowMonth}月`);
            return;
        }
        if (!month || !day) {
            alert("日付取得失敗");
            return;
        }

        function isSameDay(text, month, day) {

            const m1 = text.match(/(\d{1,2})\/(\d{1,2})/);
            if (m1) {
                if (parseInt(m1[1]) === month && parseInt(m1[2]) === day) return true;
            }

            const m2 = text.match(/(\d{1,2})（/);
            if (m2) {
                if (parseInt(m2[1]) === day) return true;
            }

            return false;
        }

        // ===== リンク取得 =====
        let timeLink = null;
        document.querySelectorAll("a").forEach(a => {
            if (a.href && a.href.includes("TimeCardIndex")) {
                timeLink = a.href;
            }
        });

        if (!timeLink) {
            alert("タイムカードリンク取得失敗");
            return;
        }

        // ===== ★1画面化：fetch =====
        const html1 = await fetch(timeLink, { credentials: "include" })
            .then(r => r.text());

        let doc = new DOMParser().parseFromString(html1, "text/html");

        // ===== iframeがある場合はさらにfetch =====
        const iframe = doc.querySelector("iframe");

        if (iframe && iframe.src) {

            const html2 = await fetch(iframe.src, { credentials: "include" })
                .then(r => r.text());

            doc = new DOMParser().parseFromString(html2, "text/html");
        }

        let start = null;
        let end = null;

        // ===== テーブル解析 =====
        const rows = doc.querySelectorAll("tr");

        for (const row of rows) {

            const text = row.innerText;

            if (!isSameDay(text, month, day)) continue;

            const times = text.match(/\d{1,2}:\d{2}/g);

            if (times && times.length >= 2) {
                start = times[0];
                end   = times[1];
                break;
            }
        }

        // ===== fallback =====
        if (!start || !end) {

            const text = doc.body.innerText;
            const lines = text.split("\n");

            for (const line of lines) {

                if (!isSameDay(line, month, day)) continue;

                const times = line.match(/\d{1,2}:\d{2}/g);

                if (times && times.length >= 2) {
                    start = times[0];
                    end   = times[1];
                    break;
                }
            }
        }

        if (!start || !end) {
            alert(`勤務時間取得失敗（対象日=${month}/${day}）`);
            return;
        }

        setTime(sh, sm, start);
        setTime(eh, em, end);

        alert(`勤務時間貼付完了（対象日=${month}/${day}）\n出勤=${start}\n退勤=${end}`);

    } catch (e) {
        console.error(e);
        alert("勤務時間処理エラー");
    }
};
if (!isTimeCard) {
    document.body.appendChild(btnTime);
}
/*document.body.appendChild(btnTime);*/
    /********** ③ 実績終了（修正済） **********/
    const btnEnd = document.createElement("button");
    btnEnd.textContent = "　　　タイムカード退勤を実績終了(時)(分)に貼付け　　";
    styleBtn(btnEnd, "400px", "#009688");

    btnEnd.onclick = () => {

        const fldH = document.querySelector("#dz_fld2362");
        const fldM = document.querySelector("#dz_fld2363");

        if (!fldH || !fldM) {
            alert("貼付先フィールド取得失敗");
            return;
        }

        const endH = eh?.value;
        const endM = em?.value;

        if (!endH || !endM) {
            alert("退勤時間が未入力です");
            return;
        }

        fldH.value = parseInt(endH, 10);
        fldM.value = parseInt(endM, 10);

        alert(`実績終了貼付完了\n退勤=${endH}:${endM}`);
    };

    document.body.appendChild(btnEnd);


/********** ④ 休憩チェック（修正版・完全版） **********/
const btnCheck = document.createElement("button");
btnCheck.textContent = "労基法34条に基づく休憩時間・申請内容整合チェック　";
styleBtn(btnCheck, "440px", "#E91E63");

btnCheck.onclick = () => {

    const toMin = (h, m) => (parseInt(h || 0) * 60 + parseInt(m || 0));
    const round5 = v => Math.floor(v / 5) * 5;
    const toH = m => (m / 60).toFixed(2);
    const toHM = m => `${Math.floor(m/60)}:${String(m%60).padStart(2,"0")}`;
    const ceil5 = v => Math.ceil(v / 5) * 5;
    const holidayEl = document.querySelector("#dz_check277770");
    const isHoliday = holidayEl ? holidayEl.checked : false;
    // ===== 値取得 =====
    const A1_raw = toMin(sh?.value, sm?.value);
    const A2_raw = toMin(eh?.value, em?.value);

    const B_raw = toMin(
        document.querySelector("#dz_fld2360")?.value,
        document.querySelector("#dz_fld2361")?.value
    );

    const C_raw = toMin(
        document.querySelector("#dz_fld2362")?.value,
        document.querySelector("#dz_fld2363")?.value
    );

    const D_raw = toMin(
        document.querySelector("#dz_fld2364")?.value,
        document.querySelector("#dz_fld2365")?.value
    );

    const E_raw = toMin(
        document.querySelector("#dz_fld2561")?.value,
        document.querySelector("#dz_fld2562")?.value
    );

    // ===== 5分丸め 切捨て=====
    const A1 = round5(A1_raw);
    const A2 = round5(A2_raw);
    const B = round5(B_raw);
    const C = round5(C_raw);
    const D = round5(D_raw);
    const E = round5(E_raw);
    // ===== 5分丸め 切上げ=====
    const A11 = ceil5(A1_raw);

// ===== 勤務区分（A3）=====
let startDef = A1;
let type = "";

if (A1 >= 300 && A1 <= 484) { startDef = 480; type="z"; }// 5:00～8:04 → 8:00
else if (A1 >= 485 && A1 <= 514) { startDef = 510; type="y"; } // 8:05～8:34 → 8:30
else if (A1 >= 515 && A1 <= 544) { startDef = 540; type="x"; } // 8:35～9:04 → 9:00
else if (A1 >= 720 && A1 <= 784) { startDef = 780; type="u"; } // 12:00～13:04 → 13:00

    let A3 = startDef;

// ===== 昼跨ぎ補正（A3は変えない）=====
let lunchAdd = 0;
if (A1 < 720 && A2 > 780) {
    lunchAdd = 60;
}
    // ===== 通常勤務終了補正 =====
let Bdef1 = B;

if (type === "z") Bdef1 = 1020; // 16:45
if (type === "y") Bdef1 = 1035; // 17:15
if (type === "x") Bdef1 = 1065; // 17:45
// uは変更しない
    // ===== 実績開始補正 =====
let Bdef = B;

if (type === "z") Bdef = 1020; // 17:00
if (type === "y") Bdef = 1050; // 17:30
if (type === "x") Bdef = 1080; // 18:00
// uは変更しない

    // ===== 休憩 =====
    const restRaw = (E - D);
    const EE = lunchAdd; // 昼休憩のみ
    const rest = restRaw + EE;
    const rest2 = restRaw;

    // ===== 計算平日 =====
    const A = (A2 - startDef);
    const AA = (A2 - A3);
    const G = ((Bdef1 - A3) + (C - Bdef)) - ((E - D) + EE);
    // ===== 計算休日 ***=====
    const A_2 = (A2 - A1);
    const AA_2 = (A2 - A1);
    const G_2 = (C - B) - (E - D);
    // ===== 勤務開始A1チェック ***=====
    let A1ck = `NG`;
    if (A1 > 0) {
        A1ck = "OK";
    }
    // ===== 勤務開始A2チェック ***=====
    let A2ck = `NG`;
    if (A2 > 0) {
        A2ck = "OK";
    }
    // ===== 平日超勤実施開始Bチェック ***=====
    let Bck = `NG`;
    if (Bdef === B) {
        Bck = "OK";
    }
    // ===== 超勤実施開始Cチェック ***=====
    let Cck = `NG`;
    if (A2 === C) {
        Cck = "OK";
    }
    // ===== 判定平日 =====
    let result = "OK";

    if (G > 360 && G <= 480) {
        const need = 45;
        if (rest < need) {
            const shortage = need - rest;
            result = `NG（労基法34条の休憩不足：45分以上必要／現在${toH(rest)}h／あと${Math.ceil(shortage)}分必要）`;
        } else {
            result = `OK（労基法34条：労働時間が６時間超えは45分の休憩が必要）`;
        }
    }

    if (G > 480) {
        const need = 60;
        if (rest < need) {
            const shortage = need - rest;
            result = `NG（労基法34条の休憩不足：60分以上必要／現在${toH(rest)}h／あと${Math.ceil(shortage)}分必要）`;
        } else {
            result = `OK（労基法34条：労働時間が８時間超えは60分の休憩が必要）`;
        }
    }
    // ===== 判定休日 =====
    let result2 = "OK";

    if (G_2 > 360 && G_2 <= 480) {
        const need = 45;
        if (rest2 < need) {
            const shortage2 = need - rest2;
            result2 = `NG（労基法34条の休憩不足：45分以上必要／現在${toH(rest2)}h／あと${Math.ceil(shortage2)}分必要）`;
        } else {
            result2 = `OK（労基法34条：労働時間が６時間超えは45分の休憩が必要）`;
        }
    }

    if (G_2 > 480) {
        const need = 60;
        if (rest2 < need) {
            const shortage2 = need - rest2;
            result2 = `NG（労基法34条休憩不足：60分以上必要／現在${toH(rest2)}h／あと${Math.ceil(shortage2)}分必要）`;
        } else {
            result2 = `OK（労基法34条：８時間超えは60分の休憩が必要）`;
        }
    }
    // ===== 表示 =====
if (isHoliday) {
    // ===== A：休日処理 =====
    let msg = `
○休日のとき(超勤　入力時間ベース)
【休憩チェック】${result2}
労働時間（G_2）：${toH(G_2)}h　休憩時間（E-D）${toH(rest2)}h　${Math.ceil(rest2)}分
＜式＞超勤時間(C - B2) - 休憩時間(E -D) = G_2
(${toH(C)} - ${toH(B)}) - (${toH(E)} - ${toH(D)}) = ${toH(G_2)}
-------------------------------------------------------------------------------
【項目整合チェック】区分：勤務区分、5分：5分切捨て、5分上：5分切上げ
A3（出勤開始）： ${toH(A11)}h　←　5分上${toHM(A11)}　←　入力${toHM(A1_raw)}${A1ck}
A4（出勤終了）： ${toH(A2)}h　←　5分${toHM(A2)}　←　入力${toHM(A2_raw)}${A2ck}
B2（超勤実施開始）：${toH(B)}h　←　A3　${toHM(A11)}　vs　5分${toHM(B)}　←　入力${toHM(B_raw)}
C （超勤実施終了）：${toH(C)}h　←　A4　${toHM(A2)}　vs　5分${toHM(C)}${Cck}　←　入力${toHM(C_raw)}
D （超勤休憩開始）：${toH(D)}h　←　5分${toHM(D)}　←　入力${toHM(D_raw)}
E （超勤休憩終了）：${toH(E)}h　←　5分${toHM(E)}　←　入力${toHM(E_raw)}
`;
    showPanel(msg.split("\n"));
} else {
    // ===== B：通常処理 =====
    let msg = `
○平日のとき(通常勤務＋超勤　タイムカード、勤務区分、昼休憩を考慮)
【休憩チェック】${result}
労働時間（G）：${toH(G)}h　休憩時間（E-D）：${toH(rest)}h　${Math.ceil(rest)}分
-------------------------------------------------------------------------------
＜式＞勤務時間((A2 - A3) + 超勤時間(C - B1)) - 休憩時間((E -D)+ EE) = G
((${toH(Bdef1)} - ${toH(A3)}) + (${toH(C)} - ${toH(Bdef)})) - ((${toH(E)} - ${toH(D)}) + ${toH(EE)}) = ${toH(G)}
-------------------------------------------------------------------------------
【項目整合チェック】区分：勤務区分、5分：5分切捨て
A3（出勤開始）： ${toH(A3)}h　←　区分${toHM(A3)}　vs　5分${toHM(A1)}　←　入力${toHM(A1_raw)}${A1ck}
A4（出勤終了）： ${toH(A2)}h　←　5分${toHM(A2)}　←　入力${toHM(A2_raw)}${A2ck}
A2（通常勤務終了）：${toH(Bdef1)}h　←　区分${toHM(Bdef1)}
B1（超勤実施開始）：${toH(B)}h　←　区分${toHM(Bdef)}　vs　5分${toHM(B)}${Bck}　←　入力${toHM(B_raw)}
C （超勤実施終了）：${toH(C)}h　←　A4　${toHM(A2)}　vs　5分${toHM(C)}${Cck}　←　入力${toHM(C_raw)}
D （超勤休憩開始）：${toH(D)}h　←　5分${toHM(D)}　←　入力${toHM(D_raw)}
E （超勤休憩終了）：${toH(E)}h　←　5分${toHM(E)}　←　入力${toHM(E_raw)}
EE（通常昼休憩）　：${toH(EE)}h
`;
    showPanel(msg.split("\n"));
}
};

document.body.appendChild(btnCheck);

    /********** 共通 **********/
    function styleBtn(btn, top, color) {
        btn.style.position="fixed";
        btn.style.top=top;
        btn.style.right="20px";
        btn.style.zIndex="999999";
        btn.style.padding="8px 14px";
        btn.style.background=color;
        btn.style.color="#fff";
    }

    function setTime(h,m,val){
        const [hh,mm]=val.split(":");
        select(h,String(Number(hh)));
        select(m,String(Number(mm)));
    }

    function select(sel,val){
        for(const opt of sel.options){
            opt.selected=(opt.value===val);
        }
    }

    function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

    async function waitLoad(tab){
        while(tab.document.readyState!=="complete"){
            await sleep(100);
        }
    }

    function showPanel(lines){
        const panel=document.createElement("div");
        panel.style=`
            position:fixed;top:80px;right:20px;
            background:#fff;border:2px solid #333;
            padding:18px;
            width:670px;height:400px;
            z-index:999999;overflow:auto;
        `;

        lines.forEach(l=>{
            const d=document.createElement("div");
            d.textContent=l;
            if(l.includes("NG")) d.style.color="red";
            panel.appendChild(d);
        });

        const btn=document.createElement("button");
        btn.textContent="OK";
        btn.style.position="absolute";
        btn.style.bottom="10px";
        btn.style.right="10px";
        btn.onclick=()=>panel.remove();

        panel.appendChild(btn);
        document.body.appendChild(panel);
    }

})();
