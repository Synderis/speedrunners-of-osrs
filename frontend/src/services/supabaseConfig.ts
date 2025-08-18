const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;

export const SUPABASE_CONFIG = {
  url: `https://${projectRef}.supabase.co`,
  bucket: 'data', // use your actual bucket name
  gearImagesPath: 'gear_images'
};

export const getGearImageUrl = (imageName: string) => {
  if (!imageName) return '';
  return `${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.bucket}/${SUPABASE_CONFIG.gearImagesPath}/${encodeURIComponent(imageName)}`;
};
