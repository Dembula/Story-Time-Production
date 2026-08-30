export type TreatmentAssetType = "image" | "video" | "link";

export type TreatmentAsset = {
  id: string;
  type: TreatmentAssetType;
  url: string;
  title?: string;
  caption?: string;
  thumbnailUrl?: string;
  source: "upload" | "url" | "library" | "pexels";
  createdAt: string;
};

export type TreatmentElementType = "text" | "image" | "shape" | "line";

export type TreatmentElement = {
  id: string;
  type: TreatmentElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  align?: "left" | "center" | "right";
  referenceId?: string;
  shape?: "rect" | "ellipse";
  fill?: string;
  stroke?: string;
};

export type TreatmentSlideLayout =
  | "title"
  | "content"
  | "split"
  | "image"
  | "references"
  | "blank";

export type TreatmentSlide = {
  id: string;
  layout: TreatmentSlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  notes?: string;
  backgroundColor?: string;
  referenceIds: string[];
  elements: TreatmentElement[];
};

export type TreatmentDocument = {
  slides: TreatmentSlide[];
  assets: TreatmentAsset[];
  settings: {
    aspectRatio: "16:9" | "4:3";
    theme: "light" | "dark";
  };
};

export type CreatorTreatmentRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  document: TreatmentDocument;
  createdAt: string;
  updatedAt: string;
  projectTitle?: string;
};
