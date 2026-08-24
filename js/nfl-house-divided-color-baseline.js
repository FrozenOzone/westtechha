(function(){
  'use strict';
  // Approved WestTech NFL House Divided production color baseline.
  // Standardized from the approved Single Team baseline generated: 2026-08-16T13:35:52.419Z
  // Mapping: field <- Center Field; band <- Accent Rings; text <- Ring Text (white fallback); house <- Center Field (accent fallback on white).
  // Palette entries include the current physical production filament reference.
  window.WestTechNFLHouseDividedFrame = {"outer":"white","inner":"black"};

  window.WestTechNFLPrintPalette = [
  {
    "id": "white",
    "label": "White",
    "hex": "#f5f5f2",
    "filament": "SUNLU White",
    "filamentStatus": "on-hand"
  },
  {
    "id": "warm-white",
    "label": "Warm White",
    "hex": "#e9e2d4",
    "filament": "SUNLU Bone White",
    "filamentStatus": "on-hand"
  },
  {
    "id": "light-gray",
    "label": "Light Gray",
    "hex": "#c4c8cc",
    "filament": "SUNLU Silver",
    "filamentStatus": "on-hand"
  },
  {
    "id": "gray",
    "label": "Gray",
    "hex": "#8d949b",
    "filament": "SUNLU Grey",
    "filamentStatus": "on-hand"
  },
  {
    "id": "dark-gray",
    "label": "Dark Gray",
    "hex": "#4d5258",
    "filament": "SUNLU Grey",
    "filamentStatus": "on-hand",
    "filamentNote": "Closest stocked dark neutral"
  },
  {
    "id": "black",
    "label": "Black",
    "hex": "#111317",
    "filament": "SUNLU Black",
    "filamentStatus": "on-hand"
  },
  {
    "id": "red",
    "label": "Red",
    "hex": "#d9232e",
    "filament": "SUNLU Cherry Red",
    "filamentStatus": "on-hand",
    "filamentNote": "Lighter/brighter red"
  },
  {
    "id": "dark-red",
    "label": "Dark Red",
    "hex": "#8b1e2d",
    "filament": "SUNLU Red",
    "filamentStatus": "on-hand",
    "filamentNote": "Darker red"
  },
  {
    "id": "orange",
    "label": "Orange",
    "hex": "#f26a21",
    "filament": "SUNLU Sunny Orange",
    "filamentStatus": "on-hand"
  },
  {
    "id": "yellow",
    "label": "Yellow",
    "hex": "#f4c430",
    "filament": "SUNLU Yellow",
    "filamentStatus": "on-hand"
  },
  {
    "id": "lime",
    "label": "Lime",
    "hex": "#77c043",
    "filament": "Lime Green \u2014 not stocked",
    "filamentStatus": "missing",
    "filamentNote": "ELEGOO Apple Green candidate"
  },
  {
    "id": "green",
    "label": "Green",
    "hex": "#168b55",
    "filament": "SUNLU Green",
    "filamentStatus": "on-hand"
  },
  {
    "id": "dark-green",
    "label": "Dark Green",
    "hex": "#1e4c3b",
    "filament": "SUNLU Olive Green",
    "filamentStatus": "on-hand",
    "filamentNote": "Current dark/forest green"
  },
  {
    "id": "royal-blue",
    "label": "Royal Blue",
    "hex": "#2447b8",
    "filament": "SUNLU Blue (Klein Blue)",
    "filamentStatus": "on-hand",
    "filamentNote": "Current blue; physical print is darker than the name"
  },
  {
    "id": "navy",
    "label": "Navy",
    "hex": "#15294d",
    "filament": "SUNLU Blue (Klein Blue)",
    "filamentStatus": "on-hand",
    "filamentNote": "Same current physical blue used for darker blue roles"
  },
  {
    "id": "light-blue",
    "label": "Light Blue",
    "hex": "#67aee8",
    "filament": "SUNLU Sky Blue",
    "filamentStatus": "on-hand"
  },
  {
    "id": "cyan",
    "label": "Cyan",
    "hex": "#27b8cf",
    "filament": "ELEGOO PLA Basic Cyan",
    "filamentStatus": "ordered",
    "filamentNote": "Ordered; fit/print test pending"
  },
  {
    "id": "teal",
    "label": "Teal",
    "hex": "#168f94",
    "filament": "ELEGOO PLA Basic Cyan",
    "filamentStatus": "ordered",
    "filamentNote": "Planned cyan/teal production filament; test pending"
  },
  {
    "id": "purple",
    "label": "Purple",
    "hex": "#5f3ba8",
    "filament": "SUNLU Purple",
    "filamentStatus": "on-hand"
  },
  {
    "id": "violet",
    "label": "Violet",
    "hex": "#7a4bd8",
    "filament": "SUNLU Purple",
    "filamentStatus": "on-hand",
    "filamentNote": "Closest stocked violet"
  },
  {
    "id": "pink",
    "label": "Pink",
    "hex": "#e88abf",
    "filament": "Pink \u2014 not stocked",
    "filamentStatus": "missing"
  },
  {
    "id": "magenta",
    "label": "Magenta",
    "hex": "#c83cb9",
    "filament": "SUNLU Red",
    "filamentStatus": "substitute",
    "filamentNote": "Current closest stocked substitute"
  },
  {
    "id": "brown",
    "label": "Brown",
    "hex": "#6f4a2c",
    "filament": "SUNLU Coffee Brown",
    "filamentStatus": "on-hand"
  },
  {
    "id": "tan",
    "label": "Tan",
    "hex": "#c6a56f",
    "filament": "SUNLU Tan",
    "filamentStatus": "on-hand"
  }
];

  window.WestTechNFLHouseDividedProfiles = {
  "ARI": {
    "field": "white",
    "band": "red",
    "text": "white",
    "house": "red",
    "approved": true,
    "notes": ""
  },
  "ATL": {
    "field": "red",
    "band": "black",
    "text": "red",
    "house": "red",
    "approved": true,
    "notes": ""
  },
  "BAL": {
    "field": "purple",
    "band": "black",
    "text": "purple",
    "house": "purple",
    "approved": true,
    "notes": ""
  },
  "BUF": {
    "field": "royal-blue",
    "band": "red",
    "text": "royal-blue",
    "house": "royal-blue",
    "approved": true,
    "notes": ""
  },
  "CAR": {
    "field": "gray",
    "band": "black",
    "text": "light-blue",
    "house": "gray",
    "approved": true,
    "notes": ""
  },
  "CHI": {
    "field": "white",
    "band": "orange",
    "text": "black",
    "house": "orange",
    "approved": true,
    "notes": ""
  },
  "CIN": {
    "field": "orange",
    "band": "black",
    "text": "orange",
    "house": "orange",
    "approved": true,
    "notes": ""
  },
  "CLE": {
    "field": "orange",
    "band": "black",
    "text": "orange",
    "house": "orange",
    "approved": true,
    "notes": ""
  },
  "DAL": {
    "field": "royal-blue",
    "band": "gray",
    "text": "royal-blue",
    "house": "royal-blue",
    "approved": true,
    "notes": ""
  },
  "DEN": {
    "field": "orange",
    "band": "royal-blue",
    "text": "white",
    "house": "orange",
    "approved": true,
    "notes": ""
  },
  "DET": {
    "field": "royal-blue",
    "band": "gray",
    "text": "royal-blue",
    "house": "royal-blue",
    "approved": true,
    "notes": ""
  },
  "GB": {
    "field": "dark-green",
    "band": "yellow",
    "text": "dark-green",
    "house": "dark-green",
    "approved": true,
    "notes": ""
  },
  "HOU": {
    "field": "white",
    "band": "dark-red",
    "text": "navy",
    "house": "dark-red",
    "approved": true,
    "notes": ""
  },
  "IND": {
    "field": "white",
    "band": "royal-blue",
    "text": "white",
    "house": "royal-blue",
    "approved": true,
    "notes": ""
  },
  "JAX": {
    "field": "teal",
    "band": "black",
    "text": "white",
    "house": "teal",
    "approved": true,
    "notes": ""
  },
  "KC": {
    "field": "red",
    "band": "yellow",
    "text": "red",
    "house": "red",
    "approved": true,
    "notes": ""
  },
  "LV": {
    "field": "gray",
    "band": "black",
    "text": "white",
    "house": "gray",
    "approved": true,
    "notes": ""
  },
  "LAC": {
    "field": "light-blue",
    "band": "yellow",
    "text": "light-blue",
    "house": "light-blue",
    "approved": true,
    "notes": ""
  },
  "LAR": {
    "field": "royal-blue",
    "band": "yellow",
    "text": "royal-blue",
    "house": "royal-blue",
    "approved": true,
    "notes": ""
  },
  "MIA": {
    "field": "white",
    "band": "orange",
    "text": "teal",
    "house": "orange",
    "approved": true,
    "notes": ""
  },
  "MIN": {
    "field": "purple",
    "band": "black",
    "text": "purple",
    "house": "purple",
    "approved": true,
    "notes": ""
  },
  "NE": {
    "field": "white",
    "band": "red",
    "text": "navy",
    "house": "red",
    "approved": true,
    "notes": ""
  },
  "NO": {
    "field": "black",
    "band": "yellow",
    "text": "black",
    "house": "black",
    "approved": true,
    "notes": ""
  },
  "NYG": {
    "field": "navy",
    "band": "dark-red",
    "text": "navy",
    "house": "navy",
    "approved": true,
    "notes": ""
  },
  "NYJ": {
    "field": "white",
    "band": "dark-green",
    "text": "white",
    "house": "dark-green",
    "approved": true,
    "notes": ""
  },
  "PHI": {
    "field": "dark-green",
    "band": "gray",
    "text": "dark-green",
    "house": "dark-green",
    "approved": true,
    "notes": ""
  },
  "PIT": {
    "field": "black",
    "band": "yellow",
    "text": "black",
    "house": "black",
    "approved": true,
    "notes": ""
  },
  "SF": {
    "field": "dark-red",
    "band": "yellow",
    "text": "dark-red",
    "house": "dark-red",
    "approved": true,
    "notes": ""
  },
  "SEA": {
    "field": "gray",
    "band": "lime",
    "text": "dark-green",
    "house": "gray",
    "approved": true,
    "notes": ""
  },
  "TB": {
    "field": "red",
    "band": "black",
    "text": "orange",
    "house": "red",
    "approved": true,
    "notes": ""
  },
  "TEN": {
    "field": "navy",
    "band": "light-blue",
    "text": "navy",
    "house": "navy",
    "approved": true,
    "notes": ""
  },
  "WAS": {
    "field": "dark-red",
    "band": "yellow",
    "text": "dark-red",
    "house": "dark-red",
    "approved": true,
    "notes": ""
  }
};
})();
