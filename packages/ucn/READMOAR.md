# UCN

## How does it work?

UCN uses a UCAN authorized event log to update the current value for a given name. UCN stands for User Controlled Names, and UCAN stands for User Controlled Authorization Network. UCN is purposefully named similarly to UCAN since UCAN is at it's core.

In UCN a _name_ is a DID, a Decentralized IDentifier. It's a cryptographic key that users create. Users use the private key of the _name_ to delegate capabilities to other parties. With the magic of UCAN, the other parties can re-delegate capabilities onward to more and more parties.

The delegated capabilities are for adding an event to the _event log_. We call the event log a _Merkle Clock_, since it is a Merkle DAG that encodes a timeline of events, with each event pointing back to the previous event.

In UCN the top (or head) of the clock is the current value for the name. Participants authorize events to be added to the clock when they recieve a UCAN invocation from another participant with a valid proof that allows the event to be added.

A merkle clock allows for events to happen concurrently. So two separate events can point back to the _same_ previous event. This is a conflict that must be resolved. In UCN when two concurrent updates happen, the resolution is to order the values alphabetically and pick the first. This allows all parties to come to the same conclusion about which update is the most recent without communicating with each other. With this in mind, UCN is not suitable for highly concurrent updates of a value.

Events can be sent peer to peer, and ideally should be sent directly to all participants to avoid conflicts. However, this is not mandatory, and in fact participants can miss event notification invocations altogether and subsequently discover events by querying another participant to determine the current head of the clock.

Missing event invocations can happen in adverse network conditions and necessitates that all events are stored to Storacha so that they are accessible to other participants via IPFS peer-to-peer communications and are permanently and publicly available even if the participant that created the event leaves the network.

Storacha runs a rendezvous merkle clock for public good that you can send event updates to, so that when two peers cannot directly talk to each other due to challenging environments (in the browser for instance), updates can still be propagated via an intermediary.

To learn more: https://medium.com/@storacha/the-only-constant-in-life-is-mutability-938658692223
