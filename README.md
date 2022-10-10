Payloads returned by [Poke API](https://pokeapi.co/) are quite heavy.

This API built with tsoa is a lightweight alternative to Poke API.

## Namespace

All API endpoints are namespaced to avoid my workshops attendees polluting
each other data.

## Endpoints

### GET /:namespace/pokemons/

Returns a list of pokemons.

### GET /:namespace/pokemons/:id

Returns a pokemon.

### POST /:namespace/pokemons/

Creates a pokemon.
