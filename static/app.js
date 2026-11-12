
let devices = [];
let links = [];
let lastSimulation = null;
let selectedDevice = null;
let currentPlan = document.body.dataset.plan || "Free";
let history = [], future = [];
let dragging = null;
let zoom=1;
const viewport = document.getElementById("topology-viewport");
function snapshot() { history.push(JSON.stringify({devices, links})); if(history.length > 60) history.shift(); future=[]; }
function applyHistory(source, destination) {
    if (!source.length) return;
    destination.push(JSON.stringify({devices, links}));
    const state=JSON.parse(source.pop()); devices=state.devices; links=state.links;
    selectedDevice=null; resetSimulationAfterEdit(); updateDashboard(); drawNetwork();
}
function undoEdit(){applyHistory(history,future)}
function redoEdit(){applyHistory(future,history)}
function ensurePlan(required) {
    const level={Free:0,Basic:1,Premium:2};
    if(level[currentPlan] >= level[required]) return true;
    alert(required + " demo subscription required. Select a plan in Plans & Billing.");
    document.getElementById("plans").scrollIntoView({behavior:"smooth"});
    return false;
}
function svgPoint(event) {
    const point=topology.createSVGPoint(); point.x=event.clientX; point.y=event.clientY;
    return point.matrixTransform(topology.getScreenCTM().inverse());
}
function refreshWorkspace() {
    const maxX=Math.max(900,...devices.map(d=>d.x+110));
    const maxY=Math.max(440,...devices.map(d=>d.y+95));
    topology.setAttribute("viewBox",`0 0 ${maxX} ${maxY}`);
    topology.style.width=maxX+"px"; topology.style.height=maxY+"px";
    const canvas=document.getElementById("topology-canvas");
    if(canvas){canvas.style.width=(maxX*(typeof zoom!=="undefined"?zoom:1))+"px";canvas.style.height=(maxY*(typeof zoom!=="undefined"?zoom:1))+"px";}
}
function editSelected() {
    const device=devices.find(d=>d.id===selectedDevice);
    if(!device) return alert("Select a device on the diagram first.");
    const name=prompt("New device name:",device.name);
    if(name===null) return;
    if(!name.trim() || name.trim().length>60) return alert("Name must be 1–60 characters.");
    snapshot(); device.name=name.trim(); resetSimulationAfterEdit(); updateDashboard(); drawNetwork();
}
function deleteSelected() {
    if(!selectedDevice) return alert("Select a device first.");
    if(!confirm("Delete selected device and its connections?")) return;
    snapshot(); devices=devices.filter(d=>d.id!==selectedDevice);
    links=links.filter(l=>l.from!==selectedDevice && l.to!==selectedDevice);
    selectedDevice=null; resetSimulationAfterEdit(); updateDashboard(); drawNetwork();
}
function disconnectSelected() {
    if(!selectedDevice) return alert("Select a device first.");
    snapshot(); links=links.filter(l=>l.from!==selectedDevice && l.to!==selectedDevice);
    resetSimulationAfterEdit(); updateDashboard(); drawNetwork();
}
function disconnectPair() {
    const a=document.getElementById("connect-from").value,b=document.getElementById("connect-to").value;
    if(!links.some(l=>(l.from===a&&l.to===b)||(l.from===b&&l.to===a))) return alert("No connection exists between those devices.");
    snapshot(); links=links.filter(l=>!((l.from===a&&l.to===b)||(l.from===b&&l.to===a)));
    resetSimulationAfterEdit(); updateDashboard(); drawNetwork();
}


const topology = document.getElementById("topology");

const colors = {
    Router: "#9869f3",
    Switch: "#c27be9",
    PC: "#5cbce9",
    Server: "#55c99c"
};


// SAMPLE OFFICE NETWORK

function loadSampleNetwork() {
    if(devices.length) snapshot();
    devices = [
        { id: "R1", name: "Main Router", type: "Router", x: 450, y: 90 },
        { id: "S1", name: "Switch 1", type: "Switch", x: 275, y: 200 },
        { id: "S2", name: "Switch 2", type: "Switch", x: 625, y: 200 },
        { id: "PC1", name: "PC-01", type: "PC", x: 145, y: 335 },
        { id: "PC2", name: "PC-02", type: "PC", x: 330, y: 335 },
        { id: "PC3", name: "PC-03", type: "PC", x: 570, y: 335 },
        { id: "PC4", name: "PC-04", type: "PC", x: 755, y: 335 },
        { id: "SRV1", name: "Office Server", type: "Server", x: 810, y: 200 }
    ];

    links = [
        { from: "R1", to: "S1" },
        { from: "R1", to: "S2" },
        { from: "S1", to: "PC1" },
        { from: "S1", to: "PC2" },
        { from: "S2", to: "PC3" },
        { from: "S2", to: "PC4" },
        { from: "S2", to: "SRV1" }
    ];

    selectedDevice = null;
    lastSimulation = null;

    updateDashboard();
    drawNetwork();
    clearSimulation();

    document.getElementById("network-status").textContent = "Ready";

    updateAI("Your sample office network is ready.",
        "Use Premium to unlock rule-based assistant analysis and recommendations.");
}


// DASHBOARD COUNTS

function updateDashboard() {
    document.getElementById("device-count").textContent = devices.length;
    document.getElementById("link-count").textContent = links.length;

    updateSelectors();
}


// DEVICE DROPDOWNS

function updateSelectors() {
    const selectIds = [
        "failure-device",
        "connect-from",
        "connect-to"
    ];

    selectIds.forEach(id => {
        const select = document.getElementById(id);
        const previousValue = select.value;

        select.innerHTML = "";

        devices.forEach(device => {
            select.add(new Option(device.name, device.id));
        });

        if (devices.some(d => d.id === previousValue)) {
            select.value = previousValue;
        }
    });
}


// DRAW NETWORK

function drawNetwork() {
    topology.innerHTML = "";
    refreshWorkspace();

    const svgNS = "http://www.w3.org/2000/svg";

    links.forEach(link => {
        const from = devices.find(d => d.id === link.from);
        const to = devices.find(d => d.id === link.to);

        if (!from || !to) return;

        const line = document.createElementNS(svgNS, "line");

        line.setAttribute("x1", from.x);
        line.setAttribute("y1", from.y);
        line.setAttribute("x2", to.x);
        line.setAttribute("y2", to.y);
        line.setAttribute("class", "network-link");
        line.dataset.from=link.from; line.dataset.to=link.to;

        topology.appendChild(line);
    });

    devices.forEach(device => {
        const group = document.createElementNS(svgNS, "g");

        group.setAttribute("class", "network-node");
        group.setAttribute(
            "transform",
            `translate(${device.x}, ${device.y})`
        );

        if (selectedDevice === device.id) {
            group.classList.add("selected");
        }

        if (lastSimulation) {
            if (device.id === lastSimulation.failed.id) {
                group.classList.add("failed");
            } else if (
                lastSimulation.affected.some(d => d.id === device.id)
            ) {
                group.classList.add("affected");
            } else if ((lastSimulation.disconnected || []).some(d => d.id === device.id)) {
                group.classList.add("disconnected");
            } else {
                group.classList.add("unaffected");
            }
        }

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("r", "23");
        circle.setAttribute(
            "fill",
            colors[device.type] || "#777777"
        );

        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("y", "43");
        label.textContent = device.name;

        group.appendChild(circle);
        group.appendChild(label);

        group.addEventListener("pointerdown", event => {
            if(event.button!==0) return;
            event.preventDefault();
            selectedDevice=device.id;
            const point=svgPoint(event);
            dragging={id:device.id, dx:device.x-point.x, dy:device.y-point.y, moved:false};
            topology.setPointerCapture(event.pointerId);
            topology.querySelectorAll(".network-node").forEach(n=>n.classList.toggle("selected",n.dataset.deviceId===device.id));
        });
        group.addEventListener("click", () => {
            selectedDevice = device.id;

            document.getElementById("failure-device").value =
                device.id;

            drawNetwork();
        });

        group.dataset.deviceId=device.id;
        topology.appendChild(group);
    });
}


// ADD DEVICE

function addDevice() {
    const type = document.getElementById("device-type").value;

    const prefixes = {
        Router: "R",
        Switch: "S",
        PC: "PC",
        Server: "SRV"
    };

    let count = 1;

    while (
        devices.some(d => d.id === prefixes[type] + count)
    ) {
        count++;
    }

    const index = devices.length;

    const newDevice = {
        id: prefixes[type] + count,
        name: type + " " + count,
        type: type,
        x: 105 + (index % 5) * 165,
        y: 110 + Math.floor(index / 5) * 125
    };

    snapshot();
    devices.push(newDevice);

    resetSimulationAfterEdit();
    updateDashboard();
    drawNetwork();

    if (currentPlan === "Premium") updateAI("A new " + type + " was added.",
        "Connect this device to another device before testing failures.");
}


// CONNECT DEVICES

function connectDevices() {
    const from = document.getElementById("connect-from").value;
    const to = document.getElementById("connect-to").value;

    if (!from || !to) {
        alert("Please add at least two devices.");
        return;
    }

    if (from === to) {
        alert("Choose two different devices.");
        return;
    }

    const alreadyConnected = links.some(link =>
        (link.from === from && link.to === to) ||
        (link.from === to && link.to === from)
    );

    if (alreadyConnected) {
        alert("These devices are already connected.");
        return;
    }

    snapshot();
    links.push({ from: from, to: to });

    resetSimulationAfterEdit();
    updateDashboard();
    drawNetwork();

    if (currentPlan === "Premium") updateAI("A new connection was added.",
        "Your topology has been updated. Run a failure simulation to test its resilience.");
}


// RESET OLD SIMULATION AFTER EDITING

function resetSimulationAfterEdit() {
    lastSimulation = null;
    clearSimulation();

    document.getElementById("network-status").textContent =
        "Ready";
}


// FAILURE SIMULATION

async function simulateFailure() {
    if (!ensurePlan("Basic")) return;
    const failedId =
        document.getElementById("failure-device").value;

    if (!failedId) {
        alert("Please select a device.");
        return;
    }

    try {
        const response = await fetch("/api/simulate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                devices: devices,
                links: links,
                failed_id: failedId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Simulation failed.");
            return;
        }

        lastSimulation = result;

        document.getElementById("network-status").textContent =
            "Failure Detected";

        document.getElementById("simulation-placeholder")
            .classList.add("hidden");

        document.getElementById("simulation-results")
            .classList.remove("hidden");

        document.getElementById("affected-count").textContent =
            result.affected.length;

        document.getElementById("unaffected-count").textContent =
            result.unaffected.length;

        showDeviceList("affected-list", result.affected);
        showDeviceList("unaffected-list", result.unaffected);
        showDeviceList("disconnected-list", result.disconnected || []);
        document.getElementById("disconnected-count").textContent=(result.disconnected||[]).length;

        document.getElementById("simulation-notice").textContent =
            "This is a virtual simulation, not a live network test.";

        drawNetwork();

        if (currentPlan === "Premium") {
            updateAI(result.explanation, result.recommendation);
        } else {
            updateAI("Premium Assistant is locked.", "Basic includes failure simulation. Upgrade to Premium for assistant insights and recommendations.");
        }

    } catch (error) {
        console.error(error);

        alert(
            "Could not connect to the Flask server. Make sure it is running."
        );
    }
}


// SHOW DEVICE LIST

function showDeviceList(elementId, list) {
    const element = document.getElementById(elementId);
    element.innerHTML = "";

    if (list.length === 0) {
        const item = document.createElement("li");
        item.textContent = "None";
        element.appendChild(item);
        return;
    }

    list.forEach(device => {
        const item = document.createElement("li");

        item.textContent =
            device.name + " (" + device.type + ")";

        element.appendChild(item);
    });
}


// RESTORE NETWORK

function restoreNetwork() {
    lastSimulation = null;
    selectedDevice = null;

    clearSimulation();
    drawNetwork();

    document.getElementById("network-status").textContent =
        "Ready";

    if (currentPlan === "Premium") updateAI("Network view restored.",
        "You can run another failure simulation.");
}


// CLEAR SIMULATION RESULTS

function clearSimulation() {
    document.getElementById("simulation-placeholder")
        .classList.remove("hidden");

    document.getElementById("simulation-results")
        .classList.add("hidden");

    document.getElementById("affected-count").textContent = "0";
    document.getElementById("unaffected-count").textContent = "0";

    document.getElementById("affected-list").innerHTML = "";
    document.getElementById("unaffected-list").innerHTML = "";
    document.getElementById("disconnected-list").innerHTML = "";
    document.getElementById("disconnected-count").textContent="0";
    document.getElementById("simulation-notice").textContent = "";
}


// RULE-BASED NETWORK ASSISTANT

async function analyzeNetwork() {
    if(!ensurePlan("Premium")) return;
    try {
        const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({devices,links})});
        const result=await response.json();
        if(!response.ok) return alert(result.error||"Analysis failed.");
        updateAI(result.summary,result.recommendation);
    } catch(error){alert("Could not reach assistant service.");}
}

// UPDATE ASSISTANT TEXT

function updateAI(summary, recommendation) {
    document.getElementById("assistant-summary").textContent =
        summary;

    document.getElementById("assistant-recommendation").textContent =
        recommendation;
}


// DOWNLOAD REPORT

function downloadReport() {
    if (!ensurePlan("Basic")) return;
    const report = {
        project: "NetTwin AI",
        reportDate: new Date().toLocaleString(),
        devices: devices,
        links: links,
        lastSimulation: lastSimulation,
        note: "Simplified virtual network prototype"
    };

    const file = new Blob(
        [JSON.stringify(report, null, 4)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(file);

    const link = document.createElement("a");
    link.href = url;
    link.download = "NetTwin_AI_Report.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}


// SUBSCRIPTION CHECKOUT

let selectedPlan = "Free";
let selectedBilling = "Free";

function openCheckout(plan) {
    selectedPlan = plan;

    // Read billing cycle from the main plans section
    const mainBilling = document.querySelector(
        'input[name="billing"]:checked'
    );

    selectedBilling = plan === "Free"
        ? "Free"
        : (mainBilling ? mainBilling.value : "Monthly");

    document.getElementById("checkout-plan").textContent =
        selectedPlan;

    // Set the correct radio button inside the checkout popup
    document.querySelectorAll(
        'input[name="checkout-billing"]'
    ).forEach(radio => {
        radio.checked = radio.value === selectedBilling;
        radio.disabled = plan === "Free";
    });

    // Free plan does not need a billing cycle
    const billingRow = document.querySelector(
        ".checkout-row:has(.billing-options)"
    );

    if (billingRow) {
        billingRow.classList.toggle("hidden", plan === "Free");
    }

    document.getElementById("checkout-message").textContent = "";

    document.getElementById("checkout-modal")
        .classList.remove("hidden");
}


function closeCheckout() {
    document.getElementById("checkout-modal")
        .classList.add("hidden");
}


async function confirmCheckout() {
    const button = document.getElementById("confirm-checkout");

    // Read the selected option directly from the checkout popup
    if (selectedPlan === "Free") {
        selectedBilling = "Free";
    } else {
        const checkedBilling = document.querySelector(
            'input[name="checkout-billing"]:checked'
        );

        if (!checkedBilling) {
            alert("Please select Monthly or Annual billing.");
            return;
        }

        selectedBilling = checkedBilling.value;
    }

    button.disabled = true;

    try {
        const response = await fetch("/api/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                plan: selectedPlan,
                billing: selectedBilling
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Subscription update failed.");
            return;
        }

        document.getElementById("current-plan").textContent =
            result.plan;

        document.getElementById("current-billing").textContent =
            result.billing === "Yearly" ? "Annual" : result.billing;

        document.getElementById("current-status").textContent =
            result.status;

        document.getElementById("current-payment").textContent =
            result.payment_method;

        document.getElementById("subscription-status").textContent =
            result.status;

        document.getElementById("checkout-message").textContent =
            result.message;

        currentPlan=result.plan;
        updatePlanLocks();
        if(currentPlan !== "Premium") updateAI("Premium Assistant is locked.", "Select Premium to unlock rule-based network insights.");
        setTimeout(closeCheckout, 1200);

    } catch (error) {
        console.error(error);
        alert("Could not update subscription.");
    } finally {
        button.disabled = false;
    }
}


// BUTTON EVENTS

document.getElementById("add-device")
    .addEventListener("click", addDevice);

document.getElementById("connect-devices")
    .addEventListener("click", connectDevices);

document.getElementById("simulate-btn")
    .addEventListener("click", simulateFailure);

document.getElementById("restore-btn")
    .addEventListener("click", restoreNetwork);

document.getElementById("analyze-btn")
    .addEventListener("click", analyzeNetwork);

document.getElementById("download-btn")
    .addEventListener("click", downloadReport);

document.getElementById("reset-btn")
    .addEventListener("click", loadSampleNetwork);

document.querySelectorAll(".choose-plan").forEach(button => {
    button.addEventListener("click", function () {
        openCheckout(this.dataset.plan);
    });
});

document.getElementById("close-checkout")
    .addEventListener("click", closeCheckout);

document.getElementById("confirm-checkout")
    .addEventListener("click", confirmCheckout);

document.getElementById("checkout-modal")
    .addEventListener("click", function (event) {
        if (event.target === this) {
            closeCheckout();
        }
    });


// START APPLICATION

loadSampleNetwork();

// Interactive topology controls
function updatePlanLocks(){
    for(const [id,plan] of [["simulate-btn","Basic"],["download-btn","Basic"],["analyze-btn","Premium"]]){
        const el=document.getElementById(id);
        if(el) el.title=({Free:0,Basic:1,Premium:2}[currentPlan]<({Free:0,Basic:1,Premium:2}[plan])) ? plan+" plan required" : "Available";
    }
}
topology.addEventListener("pointermove",event=>{
    if(!dragging) return;
    const d=devices.find(d=>d.id===dragging.id); if(!d) return;
    const pt=svgPoint(event);
    const nx=Math.max(35,Math.round(pt.x+dragging.dx));
    const ny=Math.max(55,Math.round(pt.y+dragging.dy));
    if(!dragging.moved && (Math.abs(nx-d.x)+Math.abs(ny-d.y)>3)){
        snapshot(); dragging.moved=true;
    }
    d.x=nx; d.y=ny;
    // Update existing elements instead of redrawing during drag.
    const node=Array.from(topology.querySelectorAll(".network-node")).find(g=>g.dataset.deviceId===d.id);
    if(node) node.setAttribute("transform",`translate(${d.x}, ${d.y})`);
    topology.querySelectorAll(".network-link").forEach(line=>{
        if(line.dataset.from===d.id){line.setAttribute("x1",d.x);line.setAttribute("y1",d.y)}
        if(line.dataset.to===d.id){line.setAttribute("x2",d.x);line.setAttribute("y2",d.y)}
    });
});
function finishDrag(){if(dragging){dragging=null;resetSimulationAfterEdit();drawNetwork();}}
topology.addEventListener("pointerup",finishDrag);
topology.addEventListener("pointercancel",finishDrag);
for(const [id,fn] of [["rename-device",editSelected],["delete-device",deleteSelected],["disconnect-device",disconnectSelected],["disconnect-pair",disconnectPair],["undo-device",undoEdit],["redo-device",redoEdit]]){
    document.getElementById(id).addEventListener("click",fn);
}
document.getElementById("save-network").addEventListener("click",async()=>{
    try{
        const response=await fetch("/api/network",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({devices,links})});
        const data=await response.json(); alert(data.message||data.error||"Save failed");
    }catch(e){alert("Could not save network.")}
});
function setZoom(value){zoom=Math.max(.5,Math.min(1.75,value));topology.style.transform=`scale(${zoom})`;topology.style.transformOrigin="top left";
    // transform does not alter scrollable layout; wrapper dimensions are updated instead.
    document.getElementById("topology-canvas").style.width=(parseFloat(topology.style.width)*zoom)+"px";
    document.getElementById("topology-canvas").style.height=(parseFloat(topology.style.height)*zoom)+"px";
    document.getElementById("zoom-level").textContent=Math.round(zoom*100)+"%";
}
document.getElementById("zoom-in").addEventListener("click",()=>setZoom(zoom+.15));
document.getElementById("zoom-out").addEventListener("click",()=>setZoom(zoom-.15));
document.getElementById("zoom-reset").addEventListener("click",()=>setZoom(1));
async function loadSavedNetwork(){
    try{
        const response=await fetch("/api/network");if(!response.ok)return;
        const data=await response.json();
        if(data.network && Array.isArray(data.network.devices)&&Array.isArray(data.network.links)){
            devices=data.network.devices;links=data.network.links;history=[];future=[];
            selectedDevice=null;lastSimulation=null;updateDashboard();drawNetwork();clearSimulation();
        }
    }catch(e){console.warn("Saved topology not loaded",e)}
}
updatePlanLocks();
loadSavedNetwork();
