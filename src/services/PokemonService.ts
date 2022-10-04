import { Pokemon, Prisma, PrismaClient } from "@prisma/client";
import PokeAPI, { IPokemon } from "pokeapi-typescript";
import { z } from "zod";

const prisma = new PrismaClient();

function normalizePokemon(pokemon: IPokemon) {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types.map((type) => type.type.name),
    image: pokemon.sprites.front_default,
    weight: pokemon.weight,
    height: pokemon.height,
    base_experience: pokemon.base_experience,
    forms: pokemon.forms.map((form) => form.name),
    abilities: pokemon.abilities.map((ability) => ability.ability.name),
    stats: Object.fromEntries(
      pokemon.stats.map((stat) => [stat.stat.name, stat.base_stat])
    ),
    //sprites: pokemon.sprites,
  } as unknown as PokemonDetail;
}

export type PokemonDetail = {
  id: number | string;
  name: string;
  types: string[];
  image: string;
  weight: number;
  height: number;
  base_experience: number;
  forms: string[];
  abilities: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    "special-attack": number;
    "special-defense": number;
    speed: number;
  };
};

function normalizePokemonFromDatabase(pokemon: Pokemon): PokemonDetail {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: [pokemon.type],
    weight: pokemon.weight,
    height: pokemon.height,
    image:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
    base_experience: 0,
    forms: [],
    abilities: [],
    stats: {
      hp: 0,
      attack: 0,
      defense: 0,
      "special-attack": 0,
      "special-defense": 0,
      speed: 0,
    },
  };
}

export type QueryParams = { offset?: number; limit?: number };
export type PokemonCreateFields = {
  name: string;
  type: string;
  weight?: number;
  height?: number;
};

export default class PokemonService {
  public async list(
    namespace: string,
    { limit = 10, offset = 0 }: QueryParams
  ) {
    const countPokemons = await prisma.pokemon.count({
      where: { namespace },
    });

    const newLimit = offset < countPokemons ? limit - countPokemons : limit;
    const newOffset = Math.max(offset - countPokemons, 0);

    const list = await PokeAPI.Pokemon.list(newLimit || 1, newOffset);
    const pokemons = await Promise.all(
      list.results.map(async (pokemon) => {
        return PokeAPI.Pokemon.resolve(pokemon.name);
      })
    );

    const pokemonsDb =
      countPokemons > 0
        ? await prisma.pokemon.findMany({
            where: { namespace },
            take: Number(limit),
            skip: Number(offset),
            orderBy: { id: "desc" },
          })
        : [];

    const pokemonsNormalized = pokemonsDb.map(normalizePokemonFromDatabase);
    const fetchedPokemons = pokemons.map(normalizePokemon);

    const count = countPokemons + list.count;
    const next = count > offset + limit ? offset + limit : null;
    const previous = offset > 0 ? Math.max(offset - limit, 0) : null;
    const previousLimit = offset > 0 ? (offset < limit ? offset : limit) : null;
    return {
      count,
      next:
        next !== null
          ? `https://pokeapi.fly.dev/${namespace}/pokemons?limit=${limit}&offset=${next}`
          : null,
      previous:
        previous !== null
          ? `https://pokeapi.fly.dev/${namespace}/pokemons?limit=${previousLimit}&offset=${previous}`
          : null,
      results: [...pokemonsNormalized, ...(newLimit ? fetchedPokemons : [])],
    };
  }

  public async getOne(namespace: string, name: string) {
    try {
      const pokemon = await PokeAPI.Pokemon.resolve(name);
      return normalizePokemon(pokemon);
    } catch (error) {
      const pokemon = await prisma.pokemon.findUnique({
        where: {
          namespace_name: {
            namespace,
            name,
          },
        },
      });
      return pokemon ? normalizePokemonFromDatabase(pokemon) : null;
    }
  }
  public async create(namespace: string, body: PokemonCreateFields) {
    try {
      const pokemon = await prisma.pokemon.create({
        data: {
          namespace,
          name: body.name,
          type: body.type,
          weight: body.weight || 42,
          height: body.height || 10,
        },
      });

      const normalizedPokemon: PokemonDetail =
        normalizePokemonFromDatabase(pokemon);

      return normalizedPokemon;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;

      if (error.code !== "P2002") throw error;

      return "Already exists";
    }
  }
}
