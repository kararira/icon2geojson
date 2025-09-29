// --- code.ts ---

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: number[];
  };
  properties: {
    id: string; // インスタンス名
  };
}

interface FloorData {
  floorId: string;
  geoJson: {
    type: "FeatureCollection";
    features: GeoJsonFeature[];
  };
}

figma.showUI(__html__, { width: 280, height: 160 });

// --- メインの処理 ---
const selection = figma.currentPage.selection;

if (selection.length !== 1 || selection[0].type !== 'FRAME') {
  figma.ui.postMessage({ type: 'error', message: '最上位のフレームを1つだけ選択してください。' });
} else {
  const selectedFrame = selection[0];
  const floorFrames = selectedFrame.children.filter((child): child is FrameNode => child.type === 'FRAME');
  
  if (floorFrames.length === 0) {
    figma.ui.postMessage({type: "error", message: "選択したフレーム内に、各フロアを表す子フレームを配置してください"});
  }

  // ★変更点: フロアごとのデータを格納する配列を作成
  const allFloorsData: FloorData[] = [];
  const frameHeightForYFlip = selectedFrame.height;

  // 各フロアフレームをループ
  floorFrames.forEach(floorFrame => {
    const floorId = floorFrame.name;
    const floorIconFeatures: GeoJsonFeature[] = [];

    // フレーム内の全インスタンスを検索
    const instances = floorFrame.children.filter((child): child is InstanceNode => child.type === 'INSTANCE');
    
    // 各アイコンインスタンスをGeoJSONフィーチャーに変換
    instances.forEach(instance => {
      const centerX = instance.x + instance.width / 2;
      const centerY = instance.y + instance.height / 2;
      
      const feature: GeoJsonFeature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [centerX, frameHeightForYFlip - centerY], 
        },
        properties: {
          id: instance.name, // レイヤー名をidとして保存
        },
      };
      floorIconFeatures.push(feature);
    });

    // このフロアのフィーチャーがあれば、リストに追加
    if (floorIconFeatures.length > 0) {
      allFloorsData.push({
        floorId: floorId,
        geoJson: {
          type: "FeatureCollection",
          features: floorIconFeatures,
        }
      });
    }
  });

  if (allFloorsData.length > 0) {
    figma.ui.postMessage({
      type: 'export-floor-geojson-list', // 新しいメッセージタイプ
      data: JSON.stringify(allFloorsData, null, 2),
    });
  } else {
    figma.ui.postMessage({ type: 'error', message: 'フレーム内にアイコンが見つかりませんでした。' });
  }
}