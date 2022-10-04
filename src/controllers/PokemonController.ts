import {
  Body,
  Controller,
  Get,
  Path,
  Post,
  Query,
  Route,
  SuccessResponse,
} from "tsoa";

import {
  default as PokemonService,
  PokemonCreateFields,
  PokemonDetail,
} from "../services/PokemonService";

@Route(":namespace/pokemons")
export class PokemonController extends Controller {
  @Get()
  public async getPokemons(
    @Path() namespace: string,
    @Query() limit?: number,
    @Query() offset?: number
  ): Promise<{
    count: number;
    results: PokemonDetail[];
  }> {
    return new PokemonService().list(namespace, { limit, offset });
  }

  @Get("{name}")
  public async getPokemon(
    @Path() namespace: string,
    @Path() name: string
  ): Promise<PokemonDetail | null> {
    const pokemon = new PokemonService().getOne(namespace, name);
    if (!pokemon) {
      this.setStatus(404);
      return null;
    }
    return pokemon;
  }

  @SuccessResponse("201", "Created")
  @Post()
  public async createPokemon(
    @Path() namespace: string,
    @Body() pokemon: PokemonCreateFields
  ): Promise<PokemonDetail | string> {
    return new PokemonService().create(namespace, pokemon);
  }
}

export default PokemonController;
