import { useCallback, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { UserMessageAuthor } from "@getpaseo/protocol/user-message-author";
import type { SidebarSurfaceBackdrop } from "@/styles/surface-backdrop";

/**
 * How many heads a row shows. Three reads as "a few people"; beyond that the stack starts
 * competing with the title for width and the faces stop being distinguishable at this size.
 */
const MAX_VISIBLE_HEADS = 3;
const HEAD_SIZE = 18;
// Enough overlap that the heads read as one cluster rather than as separate badges, while
// the ring keeps enough of every face to recognize the person.
const HEAD_OVERLAP = 5;
// The stack takes the height of the line it sits on — the title's 20pt one, or the meta row's
// 16pt one — so it centers on that line instead of stretching the row.
const TITLE_LINE_HEIGHT = 20;
const META_LINE_HEIGHT = 16;

/**
 * The humans who have prompted a workspace, as overlapping heads in the row's trailing area.
 *
 * An agent only carries participants when a trusted proxy identified the prompt author, so a
 * row with unattributed prompts shows nothing. The stack is decorative: it never takes a
 * press, and every head names its person for screen readers instead of relying on the image.
 */
export function SidebarParticipantHeads({
  participants,
  backdrop,
  hidden = false,
  line = "title",
}: {
  participants: readonly UserMessageAuthor[];
  backdrop: SidebarSurfaceBackdrop;
  /** Which line of the row the stack sits on. */
  line?: "title" | "meta";
  /**
   * Hovering the row reveals the archive and menu actions over the trailing area. The heads
   * keep their layout but step out of the way, the same way the timestamp yields to the
   * scrim: a face with its corner cut off by an action reads as a glitch.
   */
  hidden?: boolean;
}) {
  const visible = participants.slice(0, MAX_VISIBLE_HEADS);
  if (visible.length === 0) return null;
  return (
    <View
      style={[
        styles.stack,
        line === "meta" ? styles.stackOnMetaLine : null,
        hidden && styles.hidden,
      ]}
      pointerEvents="none"
      testID="sidebar-participant-heads"
    >
      {visible.map((participant, index) => (
        <ParticipantHead
          key={participant.username}
          participant={participant}
          backdrop={backdrop}
          isLeading={index === 0}
          zIndex={visible.length - index}
        />
      ))}
    </View>
  );
}

function ParticipantHead({
  participant,
  backdrop,
  isLeading,
  zIndex,
}: {
  participant: UserMessageAuthor;
  backdrop: SidebarSurfaceBackdrop;
  isLeading: boolean;
  zIndex: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const avatarUrl = participant.avatarUrl;
  const showImage = Boolean(avatarUrl && avatarUrl !== failedUrl);
  const source = useMemo(() => ({ uri: avatarUrl }), [avatarUrl]);
  const handleError = useCallback(() => setFailedUrl(avatarUrl ?? null), [avatarUrl]);

  return (
    <View
      role="img"
      accessibilityLabel={participant.username}
      style={[
        styles.head,
        getBackdropStyle(backdrop),
        isLeading ? null : styles.headOverlapping,
        { zIndex },
      ]}
      testID={`sidebar-participant-head-${participant.username}`}
    >
      {showImage ? (
        <Image source={source} style={styles.image} onError={handleError} />
      ) : (
        <Text style={styles.initials} numberOfLines={1}>
          {participant.username.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function getBackdropStyle(backdrop: SidebarSurfaceBackdrop) {
  switch (backdrop) {
    case "surfaceSidebar":
      return styles.headOnSidebar;
    case "surfaceSidebarHover":
      return styles.headOnHover;
    case "surfaceSidebarSelected":
      return styles.headOnSelected;
    case "surface2":
      return styles.headOnSurface2;
  }
}

const styles = StyleSheet.create((theme) => ({
  stack: {
    flexDirection: "row",
    alignItems: "center",
    height: TITLE_LINE_HEIGHT,
    flexShrink: 0,
  },
  stackOnMetaLine: { height: META_LINE_HEIGHT },
  hidden: { opacity: 0 },
  // The ring is a knockout: it is filled with the colour of the row behind the stack, so a
  // head overlapping its neighbour reads as a gap rather than as a white halo.
  head: {
    width: HEAD_SIZE,
    height: HEAD_SIZE,
    borderRadius: HEAD_SIZE / 2,
    borderWidth: 2,
    backgroundColor: theme.colors.surface3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headOverlapping: {
    marginLeft: -HEAD_OVERLAP,
  },
  headOnSidebar: { borderColor: theme.colors.surfaceSidebar },
  headOnHover: { borderColor: theme.colors.surfaceSidebarHover },
  headOnSelected: { borderColor: theme.colors.surfaceSidebarSelected },
  headOnSurface2: { borderColor: theme.colors.surface2 },
  image: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  // One letter at this size, like the project icon's fallback: two characters cannot fit
  // inside the face left visible by the neighbouring ring.
  initials: {
    color: theme.colors.foregroundMuted,
    fontSize: 9,
    fontWeight: theme.fontWeight.medium,
  },
}));
