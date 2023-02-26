//import { highlightPathInCode, clearCanvas} from "./utils.js";
import {Node, angleFromXAxis, coordAtDist} from "./graphics.js";
import {arrayUnique} from "./utils.js";

const vscode = acquireVsCodeApi();

var code = null;

var codeEl = document.getElementById("code");
codeEl.innerHTML = "";
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.style.minWidth = "100%";


function setupCanvas(){
    codeEl = document.getElementById("code");;
    let rect = codeEl.getBoundingClientRect();

    // Initialize Canvas
    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    canvas.height =  rect.height;
    canvas.width = rect.width;
    canvas.style.left = rect.left + "px";
    canvas.style.top = rect.top + "px";
}

function node_convert_to_xy(pc, pc_unroll, nodeMap)
{
  if (pc === 'L0%0%d') {
    return { type: "entry" };
  } else if (pc.charAt(0) === 'L') {
    const linename_prefix = "line ";
    const columnname_prefix = " at column ";
    const linename = nodeMap[pc].linename.substring(linename_prefix.length);
    const columnname = nodeMap[pc].columnname.substring(columnname_prefix.length);
    return { type: "L", pc: pc, x: columnname, y: linename, unroll: pc_unroll.unroll };
  } else {
    return { type: "exit" };
  }
}

function edge_with_unroll_convert_to_xy(ec, nodeMap)
{
  const from_node = node_convert_to_xy(ec.from_pc, ec.from_pc_unroll, nodeMap);
  const to_node = node_convert_to_xy(ec.to_pc, ec.to_pc_unroll, nodeMap);
  return { from_node: from_node, to_node: to_node };
}

function getNodesEdgesFromPathAndNodeMap_recursive(ec, nodeMap)
{
  var graph_ec = { edges: [], nodes: [] };
  switch (ec.name) {
    case 'series':
    case 'parallel':
      const children = ec.serpar_child;
      children.forEach(function (child_ec) {
        const child_graph_ec = getNodesEdgesFromPathAndNodeMap_recursive(child_ec, nodeMap);
        graph_ec.edges = arrayUnique(graph_ec.edges.concat(child_graph_ec.edges));
        graph_ec.nodes = arrayUnique(graph_ec.nodes.concat(child_graph_ec.nodes));
      });
      break;
    case 'edge_with_unroll':
      //console.log(`ec =\n${JSON.stringify(ec)}\n`);
      const eu_edge = edge_with_unroll_convert_to_xy(ec, nodeMap);
      graph_ec.nodes.push(eu_edge.from_node);
      graph_ec.nodes.push(eu_edge.to_node);
      graph_ec.nodes = arrayUnique(graph_ec.nodes);
      graph_ec.edges.push(eu_edge);
      break;
  }
  return graph_ec;
}

function getNodesEdgesFromPathAndNodeMap(path, nodeMap)
{
  return getNodesEdgesFromPathAndNodeMap_recursive(path, nodeMap);
}

export function highlightPathInCode(canvas, ctx, code, path, nodeMap)
{
  // canvas -> <canvas> element in HTML DOM
  // ctx -> canvas context
  // code -> <code> element in HTML DOM
  // path -> graph-ec of pcs
  // pc -> line/col names

  //var EDGES = [ { from_node: {type: "entry"}, to_node: {type: "L", x: 6, y: 6} }, { from_node: {type: "L", x: 6, y: 6}, to_node: {type: "L", x: 9, y: 6} }, { from_node: {type: "L", x: 6, y: 6}, to_node: {type: "exit"} } ];
  //var NODES = [ { node: {type: "L", x: 6, y: 6}, unroll: 1 }, { node: {type: "L", x: 9, y: 6}, unroll: 1 } ];

  //console.log(`path = ${JSON.stringify(path)}`);

  const graph_ec = getNodesEdgesFromPathAndNodeMap(path.ec, nodeMap);
  const EDGES = graph_ec.edges;
  const NODES = graph_ec.nodes;

  EDGES.forEach(element => {
      drawEdgeBetweenPoints(element.from_node, element.to_node/*, element.dashed*/);
  });

  //let scrollHeight = window.scrollHeight;
  let styles = window.getComputedStyle(code);
  let deltaY = parseInt(styles.getPropertyValue("line-height"));
  let topNode = canvas.height*1;

  NODES.forEach(element => {
      var unroll = 1;
      if (element.pc === path.to_pc) {
        unroll = path.unroll_factor_mu;
      }
      drawPointOnNode(element, unroll);
      topNode = Math.min(topNode, element.y * 1 * deltaY);
  });

  window.scroll({left:window.scrollWidth, top:topNode, behavior:'smooth'});
}

function drawText(ctx, x, y, text, color){
    ctx.fillStyle = color;
    ctx.font = "22px Arial";
    ctx.fillText(text, x, y);
}

function drawCircle(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2, color, pattern) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.stroke();
}

export function clearCanvas(canvas, ctx){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPointOnNode(node, unroll)
{
    //node = node.split("_");

    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

    let x1 = (node.x - 1) * 1 * deltaX;
    let y1 = node.y * 1 * deltaY - deltaY/4;

    let color;
    if(unroll > 1){
        let r = 10;
        color = "rgb(252, 3, 219)";
        drawCircle(ctx, x1, y1, 3, color);
        ctx.lineWidth = 1;
        drawArc(ctx, x1, y1, r, 0, 3*Math.PI/2, false, color, []);
        drawArrowHead(ctx, x1, y1-r, 0, color);
        let x = x1 + r*Math.cos(Math.PI/4);
        let y = y1 - r*Math.sin(Math.PI/4);
        const textcolor = "rgb(3, 3, 255)";
        drawText(ctx, x, y, "" + unroll, textcolor);
    } else {
        color = "rgb(255, 0, 0)";
        drawCircle(ctx, x1, y1, 3, color);
    }
}



function drawEdgeBetweenPoints(node1, node2/*, dashed*/)
{
    // node1 is predecessor
    // node2 is successor
    // Draw edge between node1 and node2

    let pattern = [];
    //if(dashed){
    //    pattern = [4, 2];
    //}

    //node1 = node1.split("_");
    //node2 = node2.split("_");

    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

    // console.log(node2);
    if (node1.type === "entry"){
      node1 = {type: "entry", y: 1, x: 1};
    }

    if (node2.type === "exit"){
      node2 = {type: "exit", y: canvas.height/deltaY, x: 1};
    }

    //if (node1.length === 2){
    //  node1.push(2);
    //}
    //if (node2.length === 2){
    //  node2.push(2);
    //}
    if (node1.x === undefined) {
      node1.x = 2;
    }
    if (node2.x === undefined) {
      node2.x = 2;
    }

    let x1 = (node1.x - 1) * 1 * deltaX;
    let y1 = node1.y * 1 * deltaY - deltaY/4;
    let x2 = (node2.x - 1) * 1 * deltaX;
    let y2 = node2.y * 1 * deltaY - deltaY/4;

    let color1 = 'rgb(255, 0, 0)';
    let color2 = 'rgb(52, 58, 235, 0.8)';
    let theta = angleFromXAxis(x1, y1, x2, y2);

    if (x1 === x2 && y1 === y2) {
      let radius = deltaX*3;
      // drawCircle(x1, y1, 2, color1);
      drawArc(ctx, x1 + radius, y1, radius, 0, 2*Math.PI, false, color2, pattern);
      drawArrowHead(ctx, x1 + 2*radius, y1, 3*Math.PI/2, color1);
      // drawCircle(x2, y2, 2, color1);
      return;
    }

    if (y1 > y2 || (y1 === y2 && x1 > x2)) {
        if (x1 >= x2) {
            var loc = 1;
            var anticlockwise = true;
        }
        else {
            var loc = -1;
            var anticlockwise = false;
        }
        var m1 = -1 * (x2 - x1) / (y2 - y1);

        var coord1 = {x:x1, y:y1};
        var coord2 = {x:x2, y:y2};

        var dist = Math.sqrt((coord1.x - coord2.x) ** 2 + (coord1.y - coord2.y) ** 2);
        if(dist < 30){
            dist = 0;
        }
        else{
            dist = Math.tan(1.309) * dist / 2;
        }
        var c1 = { x: (coord1.x + coord2.x) / 2, y: (coord1.y + coord2.y) / 2 };


        var c2 = coordAtDist(c1.x, c1.y, m1, -1 * loc * dist);

        if(y1 === y2){
            c2 = {x: c1.x, y: c1.y + loc*dist};
        }

        var theta1 = Math.atan((coord1.y - c2.y) / (coord1.x - c2.x));
        var theta2 = Math.atan((coord2.y - c2.y) / (coord2.x - c2.x));
        var r = Math.sqrt((coord1.x - c2.x) ** 2 + (coord1.y - c2.y) ** 2);

        if (loc === -1) {
            theta1 = Math.PI + theta1;
            theta2 = Math.PI + theta2;
        }
        theta1 = angleFromXAxis(c2.x, c2.y, coord1.x, coord1.y);
        theta2 = angleFromXAxis(c2.x, c2.y, coord2.x, coord2.y);

        var p = coordAtDist(c1.x, c1.y, m1, loc * (r - dist));

        if(y1 === y2){
            p = {x:c2.x, y:(c2.y - r)};
        }

        var ntheta = angleFromXAxis(c2.x, c2.y, p.x, p.y);
        if(loc === -1){
            ntheta = Math.PI/2 + ntheta;
        }
        else{
            ntheta = ntheta - Math.PI/2;
        }

        // drawCircle(ctx, x1, y1, 2, color1);
        drawArc(ctx, c2.x, c2.y, r, theta1, theta2, anticlockwise, color2, pattern);
        drawArrowHead(ctx, p.x, p.y, ntheta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);

    } else if (y1 <= y2) {
        // drawCircle(ctx, x1, y1, 2, color1);
        drawLine(ctx, x1, y1, x2, y2, color2, pattern);
        drawArrowHead(ctx, (x1+x2)/2, (y1+y2)/2, theta, color1);
        // drawArrowHead(ctx, x1, y1, theta, color1);
        // drawArrowHead(ctx, x2, y2, theta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);
    }
}

function drawArc(ctx, cx, cy, radius, theta1, theta2, anticlockwise, color, pattern)
{
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.arc(cx, cy, radius, theta1, theta2, anticlockwise);
    ctx.strokeStyle = color;
    ctx.stroke();
}


function drawArrowHead(ctx, x, y, theta, color) {

    let h = 10;
    let w = 8;

    let dir = Math.tan(theta);
    let normal = -1 / dir;

    if(theta <= Math.PI/2 || theta > Math.PI * 3/2){
        var back = -1;
    }
    else{
        var back = 1;
    }


    let baseCen = coordAtDist(x, y, dir, back * h/2);
    let baseStart = coordAtDist(x, y, dir, -1 * back * h/2);

    let coord1 = coordAtDist(baseCen.x, baseCen.y, normal, w/2);
    let coord2 = coordAtDist(baseCen.x, baseCen.y, normal, -1 * w/2);


    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(coord1.x, coord1.y);
    ctx.lineTo(coord2.x, coord2.y);
    ctx.lineTo(baseStart.x, baseStart.y);
    ctx.fill();
    ctx.closePath();
}



// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    switch (message.command) {
        case "highlight":
            highlightPathInCode(canvas, ctx, codeEl, message.path, message.nodeMap);
            break;
        case "clear":
            clearCanvas(canvas, ctx);
            break;
        case "data":
            code = message.code;
            codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
            await new Promise(r => setTimeout(r, 100));
            setupCanvas();
            break;
        default:
            break;
    }

});
vscode.postMessage({command:"loaded"});