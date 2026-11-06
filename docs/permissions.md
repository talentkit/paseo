# Daemon permissions

The daemon authorizes principals with semantic permissions. RPC names and protocol namespaces are not authority.

## Model

```text
principal -> grants
    |
    +-- authenticated by a device or service credential
    `-- opens a session with equal or narrower authority
```

A principal is the durable identity the daemon authorizes. A credential proves that a device or service represents it. Keep them separate so you can rotate credentials, attach more than one device, and revoke a Hub user without inventing daemon user accounts.

A pairing invitation is neither. It is an expiring, single-use exchange that creates a principal and credential with the permissions selected by its issuer.

## Permissions

| Permission          | Authority                                                                  |
| ------------------- | -------------------------------------------------------------------------- |
| `daemon.read`       | Daemon status, diagnostics, configuration, and provider information        |
| `daemon.manage`     | Restart, update, configuration changes, providers, skills, and plugins     |
| `tunnel.manage`     | Relay, Hub, service tunnel, and public endpoint relationships              |
| `access.manage`     | Pairing invitations, principals, credentials, grants, and revocation       |
| `workspace.read`    | Projects, workspaces, agents, timelines, files, diffs, and terminal output |
| `workspace.write`   | Prompts, agent control, files, terminals, git operations, and scripts      |
| `workspace.manage`  | Create, rename, archive, and remove projects and workspaces                |
| `automation.manage` | Schedules, heartbeats, and loops                                           |
| `hub.execute`       | Agent lifecycle, workspace titling, observation, and recovery              |

Agents and terminals use workspace authority. Both can execute code and mutate the workspace, so separate write permissions would claim an isolation boundary the daemon cannot enforce.

Connected-host management uses `tunnel.manage`; source-owned connection and metadata replacement
requires the producer or `access.manage`. Routed operations retain both caller and link authority,
see [Connected hosts](connected-hosts.md#ownership-and-authority).

Owner, operator, and viewer are UI presets expanded into explicit permissions. Do not persist them as roles. Adding a permission must not silently widen an existing principal.

Permissions are additive allows. Missing authority denies the operation. Do not add deny precedence.

## Resources

Permissions are daemon-wide today. Future grants may select workspaces or agents, but operation classification remains inside the authorization module:

```ts
type Grant = {
  permission: Permission;
  resource: { kind: "daemon" } | { kind: "workspace"; ids: string[] };
};
```

A delegating principal can grant only authority it already possesses. A session may attenuate its principal's grants but cannot widen them.

Workspace-scoped grants require every resource-bearing operation and outbound observation to enforce the same workspace boundary. In this fork, file browsing, previews, edits and transfers can reach any path the daemon user can access, including external symlink targets. A workspace cwd supplies a base for relative paths, not an access boundary. These operations must gain resource enforcement before workspace-specific access ships.

## Proxy user attribution

To label human prompts behind a reverse proxy, set `PASEO_USER_IDENTITY_PROXY_SECRET` on the
daemon. On authenticated requests, have the proxy overwrite `X-Paseo-User` with the verified
username and `X-Paseo-Proxy-Secret` with that secret. Clear both headers on unauthenticated
routes. Forward them on the `/ws` upgrade; ordinary HTTP requests do not establish a chat's
author. Keep the secret between the proxy and daemon, never in browser code.

Only use nginx's `$remote_user` when Basic auth was enforced. If another credential bypasses
Basic auth, derive the username from that validated credential. Shared credentials cannot
identify one person. Relay connections and direct connections without the proxy secret have
no proxy author. Attribution does not grant permissions or replace daemon authentication.

Set the avatar URL pattern in **Settings → your host → Overview → Prompt avatars**.
Saving applies it immediately to new prompts and reloaded history. Leave it empty to use
initials. The setting is stored as `daemon.userAvatarUrl` in `config.json`:

```json
{
  "daemon": {
    "userAvatarUrl": "https://images.example.com/users/{username}.png"
  }
}
```

Use an HTTP or HTTPS image URL with `{username}` where the encoded username belongs. The
client loads the image directly, so its URL must be accessible to the viewer. Missing images
show initials. Avatar URLs are resolved when
sending history, so changing the image host does not rewrite saved prompts.

The daemon records authors at submission, including agent creation and steering. It saves
attribution in the agent record and restores it by message ID when replaying provider history
after a restart. Old history and provider messages without a matching identity stay unattributed. Author fields are optional additions to existing messages; older mobile
clients ignore them and keep their existing send and login flows. A mobile connection through
the authenticated proxy can still author prompts that the updated web UI identifies.

## Hub

The Hub authenticates as a service principal. Its locally selected grants decide whether it may execute agents, manage the daemon, manage tunnels, or manage access.

Hub user and role identifiers remain opaque external subjects. The Hub may create and revoke linked daemon principals when granted `access.manage`; the daemon does not interpret accounts, organizations, or roles.

Hub enrollment and permission updates exchange these semantic permissions directly. Legacy persisted Hub relationships that contain `hub.execution.*` migrate once to `hub.execute` when the daemon loads them; new relationships never persist or emit transport scopes as authority.
