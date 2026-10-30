# MeshCentral viewer components

Source: MeshCentral 1.3.1, Apache-2.0. Original authorship notices retained.
Bundled from infra/mesh/node_modules/meshcentral/public/scripts:
common-0.0.1.js, agent-desktop-0.0.2.js, agent-redir-ws-0.1.1.js.
Upstream license is LICENSE.txt in this folder.

Uai modification: agent-redir-ws-0.1.1.js fixes the transport URL to
wss://mesh.internal/meshrelay.ashx instead of deriving it from the virtual page
path. No codec, cryptography or desktop protocol replacement.
viewer.js, viewer.css and index.html are the Uai adapter, packaged locally.
The adapter does not attach mouse/keyboard input for VIEW and overrides the
upstream key-release helper in that mode; the server also filters all input.
No clipboard, files, terminal, recording, WebRTC or secure-desktop controls are
exposed. Vendor code containing other upstream functions is not itself an
authorization boundary: the relay enforces the restricted protocol.

Updates must be reviewed, rebuilt and distributed in a new signed application;
there is no runtime download of these scripts.
