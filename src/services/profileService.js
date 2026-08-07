import { supabase } from "../lib/supabase";

function getSafeExtension(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return ".jpg";

  const ext = fileName
    .slice(lastDot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return ext ? `.${ext.slice(0, 8)}` : ".jpg";
}

export async function getAvatarSignedUrl(avatarPath) {
  if (!avatarPath) return null;

  const { data, error } = await supabase.storage
    .from("profile-avatars")
    .createSignedUrl(avatarPath, 60 * 60);

  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function hydrateProfileAvatar(profile) {
  if (!profile) return profile;

  return {
    ...profile,
    avatar_signed_url: await getAvatarSignedUrl(profile.avatar_path),
  };
}

export async function hydrateProfileAvatars(profiles) {
  return Promise.all((profiles ?? []).map(hydrateProfileAvatar));
}

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return hydrateProfileAvatar(data);
}

export async function updateMyProfile(userId, values) {
  const allowed = {
    name: values.name?.trim() || null,
    department: values.department?.trim() || null,
    position: values.position?.trim() || null,
    status_message: values.status_message?.trim() || null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return hydrateProfileAvatar(data);
}

export async function uploadMyAvatar(userId, file, oldAvatarPath = null) {
  if (!file) throw new Error("이미지 파일을 선택해주세요.");

  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있어요.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("프로필 사진은 최대 10MB까지 업로드할 수 있어요.");
  }

  const extension = getSafeExtension(file.name);
  const newPath = `${userId}/${crypto.randomUUID()}${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(newPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`프로필 사진 업로드 실패: ${uploadError.message}`);
  }

  const { data, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: newPath })
    .eq("id", userId)
    .select("*")
    .single();

  if (updateError) {
    await supabase.storage.from("profile-avatars").remove([newPath]);
    throw updateError;
  }

  if (oldAvatarPath && oldAvatarPath !== newPath) {
    await supabase.storage
      .from("profile-avatars")
      .remove([oldAvatarPath]);
  }

  return hydrateProfileAvatar(data);
}

export async function removeMyAvatar(userId, avatarPath) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;

  if (avatarPath) {
    await supabase.storage
      .from("profile-avatars")
      .remove([avatarPath]);
  }

  return hydrateProfileAvatar(data);
}
