///////////////////////////////////////////////////////////////////////////
// Deliverable Dependency Diagram (3D diagram)				 //
// 									 //
// Copyright (C) 2015 Andrew Pritchard andrewjpritchard@gmail.com	 //
// 									 //
// This program is free software; you can redistribute it and/or modify	 //
// it under the terms of the GNU General Public License as published by	 //
// the Free Software Foundation; either version 2 of the License, or (at //
// your option) any later version.					 //
// 									 //
// This program is distributed in the hope that it will be useful, but	 //
// WITHOUT ANY WARRANTY; without even the implied warranty of		 //
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU	 //
// General Public License for more details.				 //
// 									 //
// You should have received a copy of the GNU General Public License	 //
// along with this program; if not, write to the Free Software		 //
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA	 //
// 02110-1301, USA.							 //
///////////////////////////////////////////////////////////////////////////

//////////////
// Settings //
//////////////

// Constants and user config settings, TODO: add to GUI at a later date.
window.persist = {};
var Conf = function () {
    this.root_id = 0;           // the current root PMO id
    this.width = 2000;          // width of the svg
    this.height = 2000;         // height of the svg
    this.leftMargin = 15;       // left margin of the svg
    this.rightMargin = 15;      // right margin of the svg
    this.topMargin = 300;       // top margin of the svg
    this.bottomMargin = 15;     // bottom margin of the svg
    this.max_tree_levels = 1000; // maximum depth the diagram will go to
    this.recordTag = "record";   // the record tag to use when parsing XML
    this.sub_levels = 5;         // how many levels of stagger when
                                 // staggering vertically
    this.tooClose = 29;          // mimimum node spacing
    this.curvedLinks = false;    // curved or angled links
    this.nodeAngle = -60;        // text rotation of nodes
    this.linksNa = true;         // whether or not to display links which are N/A
    this.refresh();
};
Conf.prototype.refresh = function () {
    this.root_id = document.getElementById ("rootNode").value;
    this.width = document.getElementById ("svgWidth").value;
    this.height = document.getElementById ("svgHeight").value;
    this.leftMargin = document.getElementById ("svgLeft").value;
    this.topMargin = document.getElementById ("svgTop").value;
    this.bottomMargin = document.getElementById ("svgBottom").value;
    this.rightMargin = document.getElementById ("svgRight").value;
    this.curvedLinks = document.getElementById ("curvedOrStraight").checked;
    this.nodeAngle = document.getElementById ("textRotation").value;
    this.tooClose = Number(document.getElementById ("nodeSpacing").value);
    this.linksNa = document.getElementById ("linksNa").checked;
};

var conf = new Conf();

var cst = {
    RECORD_ID: "dep:id",
    SVG_ID: "diagram",
    SVG_CSS: "./SVGdiagram.css"
};
Object.freeze(cst);

////////////////////////////////////////////////////////////////////////////////
// Classes                                                                    //
////////////////////////////////////////////////////////////////////////////////

//////////
// Hash //
//////////

// Hashtables will not inherit from Object. Needs ECMA5. All
// properties will be own properties. The object will not inherit
// anything, even default properties from Object.prototype. To use the
// methods of Object.prototype, use Object.prototype.call. A hashtable
// may include any fields as user defined, and therefore we cannot
// rely on any properties or methods of a hash not to be overwritten
// by the user. If you want non user defined properties or methods,
// create an object with a hash as a member.
function Hash (){    
}
Hash.prototype = Object.create(null);

/////////////
// XMLRepr //
/////////////

// allows you to query the XML document. Returns arrays of
// data. Records are specified in the XML document if their tag is
// recordTag. The textContent of immediate children is considered to
// be data.

function XMLRepr (xml, recordTag){
    this.refresh(xml, recordTag);
}
// Initiate, and refresh the xml representation.
XMLRepr.prototype.refresh = function (xml, recordTag) {
    // give an ID to all the record elements cst.RECORD_ID should be a
    // unique attribute
    var list = xml.getElementsByTagName (recordTag);
    var i;
    this.xml = xml;
    this.recordTag = recordTag;
    this.length = list.length;
    for (i = 0; i < list.length; i++) {
	list[i].setAttribute (cst.RECORD_ID, i);
    }
};
// returns an array indexed by cst.RECORD_ID, of all the tags named str.
XMLRepr.prototype.getRecord = function (str) {
    var parent; 		// parent node
    var row = [];		// row of data
    var tags = this.xml.getElementsByTagName (str);
    for (var i = 0; i < tags.length; i++) {
	parent = tags[i].parentNode;
	if (parent.tagName == this.recordTag) {
	    row[parent.getAttribute (cst.RECORD_ID)] = tags[i].textContent;
	}
    }
    return row;
};
XMLRepr.prototype.getMultiRecords = function (array) {
    var that = this;
    var columns = [];
    array.forEach (function (str, index) {
	columns[index] = that.getRecord (str);
    });
    return columns;
};

///////////
// Nodes //
///////////

function Node () {
    this.data = {};		// Data soociated with the link
    this.children = [];		// The node's children
    this.parents = [];		// The node's parents
    this.siblings = [];		// for directionless links.
    // depth of a node in the tree. Can be negative.
    this.depth = 0;
    this.x = 0;			// x and y position of the node on the graph
    this.y = 0;
    this.xindex = 0;            // the index of horizontal position.
    this.traversed = false;	// whether or not the node has been
    // traversed on the tree
}
Object.defineProperty (Node.prototype, "nodeID", { // a unique numeric hash
    enumerable: true,
    get: function () {		// TODO, make this data nonspecific.
	if (this.data.hasDeliv) {
	    return this.data.delivId * 2 + 1;
	} else {
	    return this.data.initId * 2;
	}
	
    }
});

// the format for the data for initiatives and deliverables.
function NodeData (item) { 
    this.pmoId =  item[1];
    this.initId = item[3];
    this.delivId = item[5];
    this.initTime = item[2];
    this.delivTime = item[6];
    this.initName = item[0];
    this.delivName = item[4];
    this.percent = item[7];
}
Object.defineProperties(NodeData.prototype, {
    "hasDeliv": {
	enumerable: true,
	get: function() {
	    return this.delivId ? true : false;
	}
    },
    "name": {
	enumerable: true,
	get: function() {
	    return this.hasDeliv ? this.delivName : this.initName;
	}
    },
    "time": {
	enumerable: true,
	get: function() {
	    return this.hasDeliv ? this.delivTime : this.initTime;
	}
    }
});


///////////
// Links //
///////////

// A link between two nodes. Each link has a dependent and a supplying
// node, and data associated with the link itself.
function Link (depNode, supNode, data) {
    this.depNode = depNode;
    this.supNode = supNode;
    this.data = data;
    this.childIndex = 0;
}
// data for delivering/supplying link.
function LinkData (health) {
    this.health = "";
    switch (health) {
    case "No Longer Required" :
	this.health = "Na";
	break;
    case "Concern" :
    case "Good" :
    case "Problem" :
    case "Complete" :
	this.health = health;
    }
}

///////////////
// Hierarchy //
///////////////

// Creates a hierarchy, with the root nodes specified by
// rootNodes. The Hierarchy specifies the depth of the nodes and
// links, and provides ways of iterating through nodes only in a
// specified tree
function Hierarchy (nodes, rootNodes) {
    this.nodes = nodes;         // All possible nodes of the tree
    this.rootNodes = rootNodes; // A list of all nodes which will have depth 0
    this.treeNodes = [];        // A list of all nodes connected to the rootnode
    this.treeLinks = [];        // Links connected to rootNode
}
Hierarchy.prototype.traverseDown = function (nodeCallback, linkCallback) {
    // all the nodes have not been traversed
    var nodeList = this.rootNodes; // Tn array of all the nodes at depth 0
    var currentDepth = 0;	   // The current depth being iterated over.
    var newNodeList;		   // The next set of nodes to iterate over.
    var allNodes = [];	   // All of the nodes in the tree.
    var treeLinks = [];    // all of the links in the tree
    var xindex;            // te x index of the node for all nodes at the same depth
    var nodesAtDepth = [];  // a list of all nodes at the current depth
    var childIndex;         // indicates the index of the links.
    
    this.nodes.forEach (function (node){
	node.traversed = false;
    });
    
    while (nodeList.length !== 0) {
	newNodeList = [];
        nodeList.sort(function (nodeA, nodeB) {
	    return nodeA.data.time - nodeB.data.time;
        });
        xindex = 0.0;
        nodesAtDepth = [];
	nodeList.forEach (function (node) {
	    // If we haven't checked this node yet:
	    if (node.traversed === false) { 
		node.traversed = true; // mark it.
                childIndex = 0;

		node.depth = currentDepth; // set the depth
                allNodes.push (node);      // add to allNodes,
		// Traverse it's children in the next iteration
                
		node.children.forEach (function (child) {
                    if (child.data.health != "Na" || conf.linksNa == true)
                    {           // controls the display of nodes which are Na
                        newNodeList.push (child.depNode);
		        treeLinks.push (child);
                        child.childIndex = childIndex;
		        linkCallback (child);
                        childIndex += 1;
                    }
		});
                
                if (childIndex != 0)
                {
                    node.xindex = xindex; // TODO change xindex.
                    xindex += 1;    // set horiontal index
                    nodesAtDepth.push (node);
                }
		// call the function on the node.
		nodeCallback (node);
	    }
	});
        if (nodesAtDepth[1] !== undefined)
            // must have at least two nodes to scale xindex without div0
        {
            xindex = nodesAtDepth.slice(-1)[0].xindex;
            nodesAtDepth.forEach (function (node) {
                node.xindex /= xindex;
            });
        }
	currentDepth += 1;
	nodeList = newNodeList;
    }
    this.treeNodes = allNodes;
    this.treeLinks = treeLinks;
    return allNodes;
};

/////////////
// Charter //
/////////////

// Actually draws the links and nodes
function Charter (mySvg, scalex, scaley) {
    this.svg = mySvg;
    this.rows = [];
    this.columns = [];
    this.scalex = scalex;
    this.scaley = scaley;

    var nS = this.svg.namespaceURI;

    this.svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    this.svg.setAttribute("width", conf.width);
    this.svg.setAttribute("height", conf.height);
    this.svg.setAttribute("id", "diagram");
    this.svg.setAttribute("version", "1.1");
    this.svg.setAttribute("baseProfile", "full");

    var style = document.createElementNS (nS, "style");
    this.svg.appendChild(style);
    style.setAttribute ("type", "text/css");

    var defs = document.createElementNS (nS, "defs");
    var marker = document.createElementNS (nS, "marker");
    marker.setAttribute ("id", "circleMarker");
    marker.setAttribute ("markerWidth", "8");
    marker.setAttribute ("markerHeight", "8");
    marker.setAttribute ("refX", "5");
    marker.setAttribute ("refY", "5");
    marker.setAttribute ("orient", "auto");

    var circle = document.createElementNS (nS, "circle");
    circle.setAttribute ("cx", "5");
    circle.setAttribute ("cy", "5");
    circle.setAttribute ("r", "2");
    // circle.setAttribute ("", "none");

    // var circle = document.createElementNS (nS, "polygon");
    // circle.setAttribute ("points", "0,0 0,6 6,3");

    marker.appendChild (circle);
    defs.appendChild (marker);
    this.svg.appendChild (defs);

    this.links = document.createElementNS (nS, "g");
    this.links.setAttribute ("id", "links");
    this.svg.appendChild (this.links);
    
    this.nodes = document.createElementNS (nS, "g");
    this.nodes.setAttribute ("id", "nodes");
    this.svg.appendChild (this.nodes);
    style.textContent = document.getElementById("SVGdiagramCss").textContent;
    // loadXMLDoc (css, function (xmlhttp) {
    //     style.textContent = xmlhttp.responseText
    // });
}
Charter.prototype.widthModify = function (discreteRow, continuousX, tooClose) {
    if (this.columns[discreteRow] === undefined) {
	this.columns[discreteRow] = continuousX;
	return continuousX;
    } else if (continuousX - this.columns[discreteRow] > tooClose) {
	this.columns[discreteRow] = continuousX;
	return continuousX;
    } else {
	this.columns[discreteRow] += tooClose;
	return this.columns[discreteRow];
    }
};
Charter.prototype.stagger = function (discreteRow, continuousX, tooClose) {
    var subRow;
    if (this.rows[discreteRow] === undefined) {
	this.rows[discreteRow] = [continuousX];
	return 0;
    }
    for (subRow = 0;; subRow++) {
	if (this.rows[discreteRow][subRow] === undefined) {
	    this.rows[discreteRow][subRow] = continuousX;
	    return getStagger(subRow);
	} else if (Math.abs(continuousX -
			    this.rows[discreteRow][subRow]) > tooClose) {
	    this.rows[discreteRow][subRow] = continuousX;
	    return this.getStagger(subRow);
	}
    }
};
Charter.prototype.getStagger = function (subRow) {
    if (subRow > conf.sub_levels / 2){
	return subRow - conf.sub_levels;
    } else {
	return subRow;
    }	    
};
Charter.prototype.addNode = function (node) {
    var nS = this.svg.namespaceURI;
    var g = document.createElementNS (nS, "g");
    var child;
    
    g.setAttribute ("class", "node");
    g.setAttribute ("transform", "translate(" + node.x + "," + node.y + ")");

    if (node.data.hasDeliv === true) {
	child = document.createElementNS (nS, "circle");
	child.setAttribute ("r", "13");
	child.setAttribute ("class", "bg");
	g.appendChild (child);
	
	if (node.data.percent == 1) {
	    child = document.createElementNS (nS, "circle");
	    child.setAttribute ("r", "13");
	    child.setAttribute ("class", "complete");
	} else if (node.percent != 0) {
	    child = document.createElementNS (nS, "path");
	    this.percentArc(child, 0, 0, 10, node.data.percent);
	}
    } else {
	child = document.createElementNS (nS, "rect");
	child.setAttribute ("width", "13");
	child.setAttribute ("height", "13");
	child.setAttribute ("x", "-6.5");
	child.setAttribute ("y", "-6.5");
    }

    g.appendChild (child);

    child = document.createElementNS (nS, "text");
    child.setAttribute ("dx", "17");
    child.setAttribute ("dy", "-1");
    child.setAttribute ("style", "text-anchor: start;");
    child.setAttribute ("transform", "rotate(" + conf.nodeAngle + ")");
    var myDate = new Date (Number(node.data.time));
    
    var tspan = document.createElementNS (nS, "tspan");
    tspan.textContent = node.data.pmoId + " - " + myDate.toDateString();
    
    child.appendChild (tspan);

    tspan = document.createElementNS (nS, "tspan");
    tspan.setAttribute ("dy", "10");
    tspan.setAttribute ("x", "17");
    tspan.textContent = node.data.name;
    
    child.appendChild (tspan);

    g.appendChild (child);
    this.nodes.appendChild(g);
    return g;
};
Charter.prototype.addCurvedLink = function addlink (link) {
    var nS = this.svg.namespaceURI;
    var path = document.createElementNS (nS, "path");
    path.setAttribute ("class", "link_" + link.data.health);
    // path.setAttribute ("style", "marker-end: url(#Triangle)");

    // curved lines
    if (link.depNode.depth == link.supNode.depth){
	var y1 = link.depNode.y - 4;
	var y2 = link.supNode.y - 4;
	var onethird = (link.depNode.y -
			(Math.abs(link.depNode.x - link.supNode.x)) / 2 );
	path.pathSegList.appendItem(
	    path.createSVGPathSegMovetoAbs(link.depNode.x, y1));
	path.pathSegList.appendItem(
	    path.createSVGPathSegCurvetoCubicAbs(
		link.supNode.x, y2, link.depNode.x, onethird,
		link.supNode.x, onethird));
    } else {
	var twothird = (link.depNode.y * 2 + link.supNode.y) / 3;
	var onethird = (link.depNode.y + link.supNode.y * 2) / 3;
	path.pathSegList.appendItem(
	    path.createSVGPathSegMovetoAbs(link.depNode.x, link.depNode.y));
	path.pathSegList.appendItem(
	    path.createSVGPathSegCurvetoCubicAbs(
		link.supNode.x, link.supNode.y, link.depNode.x, onethird,
		link.supNode.x, twothird));
    }
    this.links.appendChild(path);
    return path;
};
Charter.prototype.addAngledLink = function addlink (link) {
    var nS = this.svg.namespaceURI;
    var path = document.createElementNS (nS, "path");
    var yRel;
    path.setAttribute ("class", "link_" + link.data.health);
    path.setAttribute ("marker-mid", "url(#circleMarker)");
    // path.setAttribute ("style", "marker-end: url(#Triangle)");

    // Angled Lines
    yRel = (link.supNode.depth + (0.45 * link.supNode.xindex + 0.15));
    yRel = this.scaley.scale (yRel);
    
    path.pathSegList.appendItem(
	path.createSVGPathSegMovetoRel(link.supNode.x, link.supNode.y));
    path.pathSegList.appendItem(
	path.createSVGPathSegLinetoVerticalAbs(yRel));
    path.pathSegList.appendItem(
	path.createSVGPathSegLinetoHorizontalAbs(link.depNode.x));
    path.pathSegList.appendItem(
	path.createSVGPathSegLinetoVerticalAbs(link.depNode.y));
    
    this.links.appendChild(path);
    return path;
};
Charter.prototype.percentArc = function (elem, cx, cy, r, percent) {
    // returns a pie corresponding to a circular arc with radius r, with a
    // centre cx, cy, with an angle corresponding to the percentage
    // "percent"
    var x1 = cx;
    var y1 = cy - r;
    var angle = percent * 2 * Math.PI;
    var x2 = cx - Math.sin(angle) * r;
    var y2 = cy - Math.cos(angle) * r;
    var bigarc = angle > Math.PI ? 1 : 0;
    elem.pathSegList.appendItem(
	elem.createSVGPathSegMovetoAbs(x1, y1));
    elem.pathSegList.appendItem(
	elem.createSVGPathSegArcAbs(x2, y2, r, r, 0, bigarc, 0));
};
Charter.prototype.verticalLine = function (xPos, string) {
    var nS = this.svg.namespaceURI;
    var path = document.createElementNS (nS, "path");
    var g = document.createElementNS (nS, "g");
    var text = document.createElementNS (nS, "text");

    g.setAttribute ("transform", "translate(" + this.scalex.scale(xPos) + ", 0 )");

    path.setAttribute ("class", "verticalLine");
    path.pathSegList.appendItem(
	path.createSVGPathSegMovetoRel(0, 0));
    path.pathSegList.appendItem(
	path.createSVGPathSegLinetoVerticalAbs(conf.height));

    g.appendChild(path);

    text.setAttribute ("transform", "rotate(-90)");
    text.setAttribute ("style", "text-anchor: end;");
    text.setAttribute ("dy", "-1em");   
    text.textContent = string;

    g.appendChild(text);

    this.svg.appendChild(g);  
};

//////////////////////////////////////////////////////////////////////////////
// Functions                                                                //
//////////////////////////////////////////////////////////////////////////////

// loads the local XML data.
function loadData () {
    var xml = document.getElementById("xmlDocument").files;
    var reader = new FileReader();
    reader.onloadend = function() {
        getXmlDoc (reader.result);
    };
    reader.readAsText(xml[0]);
}

// A really bautiful function to save a file.
function download (text, name, type) {
    var a = document.getElementById("downloadSVGDummy");
    var file = new Blob([text], {type: type});
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
}

// wrpper for the above function to get the diagram
function downloadSVG () {
    var today = new Date();
    download (document.getElementById(cst.SVG_ID).parentNode.innerHTML,
              today.toISOString() + "_ddd.svg", "image/svg+xml");
}

function getXmlDoc(text) {
    var parser;
  	var xmlDoc;
    if (window.DOMParser) {
        parser=new DOMParser();
        xmlDoc=parser.parseFromString(text,"text/xml");
    } else { // Internet Explorer
        xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async=false;
        xmlDoc.loadXML(text);
    }
    parseData(xmlDoc);
}

function parseData (xmlDoc) {
    conf.refresh();
    var xmlDBase = new XMLRepr (xmlDoc, conf.recordTag);
    var nodes = [];
    var links = [];

    var records = xmlDBase.getMultiRecords ([
	// Items to do with dependents. Index: 0 .. 7
	"dependent_initiative",
	"dependent_pmo_id",
	"dependent_initiative_end_date",
	"select_dependent_initiative", 
	"dependent_deliverable",
	"select_dependent_deliverable",
	"dependent_deliverable_actual_forecast_end",
	"dependent_deliverable__complete",
	// Items to do with suppliers. Index: 8 .. 15
	"supplying_initiative_name",
	"supplying_pmo_id",
	"supplying_initiative_end_date",
	"select_supplying_initiative",
	"supplying_deliverable",
	"select_supplying_deliverable",
	"supplying_deliverable_actual_forecast_end",
	"supplying_deliverable__complete",
	// items to do with the link.  Index: 16
	"delivery_confidence"
    ]);

    // loop which traverses all the links and makes an object tree out of it.
    for (var i = 0; i < xmlDBase.length; i++) {
	var depNode = new Node();
	depNode.data = new NodeData ([
	    records[0][i], 	// initiative name
	    records[1][i],	// xml ID
	    records[2][i],	// initiative end time
	    records[3][i],	// initiative ID
	    records[4][i],	// deliverable name
	    records[5][i],	// deliverable ID
	    records[6][i],	// deliverable end time
	    records[7][i]	// deliverable % complete
	]);
	if (nodes[depNode.nodeID] === undefined) {
	    nodes[depNode.nodeID] = depNode;
	} else {
	    depNode = nodes[depNode.nodeID];
	}
	var supNode = new Node();
	supNode.data = new NodeData([
	    records[8][i], 	// initiative name
	    records[9][i],	// xml ID
	    records[10][i],	// initiative end time
	    records[11][i],	// initiative ID
	    records[12][i],	// deliverable name
	    records[13][i],	// deliverable ID
	    records[14][i],	// deliverable end time
	    records[15][i]	// deliverable % complete
	]);
	if (nodes[supNode.nodeID] === undefined) {
	    nodes[supNode.nodeID] = supNode;
	} else {
	    supNode = nodes[supNode.nodeID];
	}
	var link = new Link (
	    depNode, supNode, new LinkData (records[16][i]));
        links.push (link);
       	depNode.parents.push (link);
	supNode.children.push (link);
    }

    var initiatives = [];
    nodes.forEach (function (node) {
        initiatives[node.data.initId] = node;
    });
    var select = document.getElementById ("rootNode");
    initiatives.forEach (function (node, index) {
        var option = document.createElement ("option");
        option.setAttribute ("value", index);
        option.textContent = node.data.pmoId + " - " + node.data.initName;
        select.appendChild (option);
    });
    
    window.persist.nodes = nodes;
    window.persist.links = links;
}

function display () {
    var nodes;                  // nodes in the diagram;
    var links;                  // links in the diagram;
    var rootNodes;              // the rootnodes to be used to draw the diagram
    var data;                   // a tree of all the nodes
    var scaler;                 // helps with scaling
    var scalex;                 // the scaler for the x axis
    var scaley;                 // the scaler for the y axis
    var svg;                    // the svg element
    var chart;                  // the object which draws the cahrt
    var sortedNodes;            // helps display the nodes.

    conf.refresh();
    nodes = window.persist.nodes;
    links = window.persist.links;
    rootNodes = nodes.filter (function (obj) {
	return obj.data.initId == [conf.root_id];
    });
    data = new Hierarchy(nodes, rootNodes);

    scaler = {minT: Number(rootNodes[0].data.time),
	      maxT: 0,
	      minD: 0,
	      maxD: 0};
    
    
    data.traverseDown(function(obj) {
	scaler.minT = scaler.minT > Number(obj.data.time) ?
            Number(obj.data.time) : scaler.minT;
	scaler.maxT = scaler.maxT < Number(obj.data.time) ?
            Number(obj.data.time) : scaler.maxT;
	scaler.minD = scaler.minD > obj.depth ? obj.depth : scaler.minD;
	scaler.maxD = scaler.maxD < obj.depth ? obj.depth : scaler.maxD;
    }, function (){});
    
    scalex = new simpleScale (scaler.minT, scaler.maxT, conf.leftMargin,
                                  conf.width - conf.rightMargin);
    scaley = new simpleScale (0, scaler.maxD, conf.topMargin, conf.height - 
                              conf.bottomMargin);
    
    svg = document.getElementById ("diagram");
    if (svg != null)
    {
        svg.parentNode.removeChild(svg);
    }
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.getElementById("diagramWrapper").appendChild(svg);

    chart = new Charter(svg, scalex, scaley);

    var date = new Date();    
    chart.verticalLine(Date.now(), date.toDateString());

    sortedNodes = data.treeNodes.slice().sort (function (nodeA, nodeB) {
	return nodeA.data.time - nodeB.data.time;
    });
    
    sortedNodes.forEach(function(obj) {
	obj.x = scalex.scale(Number(obj.data.time));
	obj.x = chart.widthModify (obj.depth, obj.x, conf.tooClose);
	obj.y = scaley.scale(Number(obj.depth));
	chart.addNode(obj);
    });
    if (conf.curvedLinks === true){      
        data.treeLinks.forEach (function (obj) {
	    chart.addCurvedLink (obj);
        });
    }
    else {
        data.treeLinks.forEach (function (obj) {
	    chart.addAngledLink (obj);
        });
    }
}

function simpleScale (dMi, dMa, rMi, rMa) {
    this.domainMin = Number(dMi);
    this.domainMax = Number(dMa);
    this.rangeMin = Number(rMi);
    this.rangeMax = Number(rMa);
    this.scale = function (number) {
	return (((Number(number) - this.domainMin) /
                 (this.domainMax - this.domainMin)) *
		(this.rangeMax - this.rangeMin)) + this.rangeMin;
    };
}

function depDBase (myxml) {
    var that = this;
    var xml = {};
    var records = [];
    this.fields = [];

    // parses the database for records
    var getRecords = function (xml) {
	var recordsArr = [];
	var records = xml.getElementsByTagName("record");
	for (var i = 0; i < records.length; i++) {
	    var recordArr = [];
	    var record = records[i].getElementsByTagName("f");
	    for (var j = 0; j < record.length; j++) {
		recordArr[record[j].id] = record[j].textContent;
	    }
	    recordsArr[i] = recordArr;
	}
	return recordsArr;
    };
    // parses the fields for names.
    var getFields = function (xml) {
	var fieldIDs = [];
	var fields = xml.getElementsByTagName("field");
	for (var i = 0; i < fields.length; i++) {
	    fieldIDs[fields[i].id] =
		fields[i].getElementsByTagName("label")[0].textContent;
	}
	return fieldIDs;
    };
    // returns a dataset with all records, but only the fields
    // specified in the array "req" The order of the fields will be
    // the order win which they appear in req.
    this.getRecordData = function (req) {
	var data = [];
	for (var record = 0; record < records.length; record++) {
	    var dataPoint = [];
	    for (var axis = 0; axis < req.length; axis++) {
		dataPoint[axis] = records[record][req[axis]];
	    }
	    data[record] = dataPoint;
	}
	return data;
    };
    // returns an array of data indexed by the value of the field
    // "index", it will only contain the fields specified in the array
    // req. It will return the
    // last non unique element each time.
    this.getOrderedData = function (index, req) {
	var data = [];
	for (var record = 0; record < records.length; record++) {
	    var dataPoint = [];
	    for (var axis = 0; axis < req.length; axis++) {
		dataPoint[axis] = records[record][req[axis]];
	    }
	    data[records[record][index]] = dataPoint;
	}
	return data;
    };
    this.refresh = function (myxml) {
	xml = myxml;
	records = getRecords (xml);
	that.fields = getFields (xml);
    };
    this.refresh (myxml);
}

// onload function for the window
function loadPage () {
    loadXMLDoc (conf.xmlDocPath, parseData);
}

// generic function to request XML form the server.
function loadXMLDoc (dbase, callback) {
    var xmlhttp;
    if (window.XMLHttpRequest) { // code for IE7+, Firefox, Chrome, Opera, Safari
	xmlhttp=new XMLHttpRequest();
    }
    else {// code for IE6, IE5
	xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.onreadystatechange=function() {
	if (xmlhttp.readyState==4 && xmlhttp.status==200) {
	    callback (xmlhttp);
	}
    };
    xmlhttp.open("GET", dbase, true);
    xmlhttp.send();
}
