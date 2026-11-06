import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { Pencil } from "lucide-react-native";
import { UserAvatarUrlSchema } from "@getpaseo/protocol/user-message-author";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { SettingsCard, SettingsInfoTip, SettingsRow, SettingsSection } from "@/components/settings";
import { ToolbarButton } from "@/components/ui/pane-content-toolbar";
import { useToast } from "@/contexts/toast-context";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { useHostFeature } from "@/runtime/host-features";
import { useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { ICON_SIZE, type Theme } from "@/styles/theme";

const ThemedPencil = withUnistyles(Pencil);
const mutedColorMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });

interface AvatarUrlRowProps {
  savedValue: string;
  patchConfig: ReturnType<typeof useDaemonConfig>["patchConfig"];
}

function AvatarUrlRow({ savedValue, patchConfig }: AvatarUrlRowProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [editorValue, setEditorValue] = useState<string | null>(null);
  const openEditor = useCallback(() => setEditorValue(savedValue), [savedValue]);
  const closeEditor = useCallback(() => setEditorValue(null), []);
  const validate = useCallback(
    (value: string) => {
      if (UserAvatarUrlSchema.safeParse(value.trim()).success) return null;
      return t("settings.host.userAvatars.invalidUrl");
    },
    [t],
  );
  const save = useCallback(
    async (value: string) => {
      const result = await patchConfig({ userAvatarUrl: value.trim() });
      if (!result) throw new Error(t("workspace.terminal.hostDisconnected"));
      toast.show(t("settings.host.userAvatars.saved"), { variant: "success" });
    },
    [patchConfig, t, toast],
  );
  const info = useMemo(
    () => (
      <SettingsInfoTip
        title={t("settings.host.userAvatars.url")}
        info={t("settings.host.userAvatars.info")}
      />
    ),
    [t],
  );

  return (
    <>
      <SettingsCard testID="host-user-avatars-card">
        <SettingsRow label={t("settings.host.userAvatars.url")} labelAccessory={info}>
          <View style={styles.valueRow}>
            <Text
              style={styles.value}
              numberOfLines={1}
              ellipsizeMode="middle"
              testID="host-user-avatar-value"
            >
              {savedValue || t("settings.host.userAvatars.initials")}
            </Text>
            <ToolbarButton
              compact
              onPress={openEditor}
              label={t("settings.host.userAvatars.edit")}
              testID="host-user-avatar-edit"
            >
              <ThemedPencil size={ICON_SIZE.sm} uniProps={mutedColorMapping} />
            </ToolbarButton>
          </View>
        </SettingsRow>
      </SettingsCard>
      {editorValue !== null ? (
        <AdaptiveRenameModal
          visible
          title={t("settings.host.userAvatars.url")}
          initialValue={editorValue}
          placeholder="https://images.example.com/{username}.png"
          hint={t("settings.host.userAvatars.info")}
          submitLabel={t("common.actions.save")}
          allowEmpty
          validate={validate}
          onClose={closeEditor}
          onSubmit={save}
          testID="host-user-avatar-modal"
        />
      ) : null}
    </>
  );
}

export function UserAvatarsSection({ serverId }: { serverId: string }) {
  const { t } = useTranslation();
  const isConnected = useHostRuntimeIsConnected(serverId);
  const isSupported = useHostFeature(serverId, "userAvatarSettings");
  const { config, patchConfig } = useDaemonConfig(serverId);
  if (!isConnected || !isSupported || !config) return null;

  return (
    <SettingsSection title={t("settings.host.userAvatars.title")}>
      <AvatarUrlRow
        key={serverId}
        savedValue={config.userAvatarUrl ?? ""}
        patchConfig={patchConfig}
      />
    </SettingsSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    flexShrink: 1,
    maxWidth: 360,
  },
  value: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.base, flexShrink: 1 },
}));
