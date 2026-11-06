import { useState, useMemo, useCallback } from "react";
import { Image, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { UserMessageAuthor } from "@getpaseo/protocol/user-message-author";

export function HumanMessageAuthorName({ author }: { author: UserMessageAuthor | undefined }) {
  if (!author) return null;
  return (
    <Text style={styles.name} numberOfLines={1} testID="user-message-author">
      {author.username}
    </Text>
  );
}

export function HumanMessageAvatar({ author }: { author: UserMessageAuthor }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(author.avatarUrl && author.avatarUrl !== failedUrl);
  const source = useMemo(() => ({ uri: author.avatarUrl }), [author.avatarUrl]);
  const onError = useCallback(() => setFailedUrl(author.avatarUrl ?? null), [author.avatarUrl]);
  return (
    <View style={styles.avatar} testID="user-message-avatar-frame">
      {showImage ? (
        <Image
          source={source}
          style={styles.image}
          onError={onError}
          accessibilityLabel={author.username}
          testID="user-message-avatar"
        />
      ) : (
        <Text style={styles.initials}>{author.username.slice(0, 2).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  name: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing[1],
  },
  avatar: {
    width: theme.spacing[8],
    height: theme.spacing[8],
    borderRadius: theme.spacing[8],
    backgroundColor: theme.colors.surface3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { position: "absolute", width: "100%", height: "100%" },
  initials: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
}));
