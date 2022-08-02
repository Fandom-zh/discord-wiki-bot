import { Message, PermissionFlagsBits } from 'discord.js';
import { got, sendMessage } from '../util/functions.js';
import phabricator from '../functions/phabricator.js';
import check_wiki from '../cmds/wiki/general.js';

/**
 * Post a message with wiki links.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction.
 * @param {import('../util/i18n.js').default} lang - The user language.
 * @param {import('../util/wiki.js').default} wiki - The wiki for the interaction.
 */
 function slash_wiki(interaction, lang, wiki) {
	var title = interaction.options.getString('title') ?? '';
	var ephemeral = ( interaction.options.getBoolean('ephemeral') ?? true ) || pausedGuilds.has(interaction.guildId);
	var noEmbed = interaction.options.getBoolean('noembed') || ( interaction.inGuild() && !interaction.appPermissions?.has(PermissionFlagsBits.EmbedLinks) );
	var spoiler = interaction.options.getBoolean('spoiler') ? '||' : '';
	if ( ephemeral ) lang = lang.uselang(interaction.locale);
	return interaction.deferReply( {ephemeral} ).then( () => {
		( /^phabricator\.(wikimedia|miraheze)\.org$/.test(wiki.hostname)
		? phabricator(lang, interaction, wiki, new URL('/' + title, wiki), spoiler, noEmbed)
		: check_wiki(lang, interaction, title, wiki, '</wiki:1002947514900693002> title:', undefined, spoiler, noEmbed)
		).then( result => {
			if ( !result || result instanceof Message ) return result;
			if ( result.message ) {
				if ( Array.isArray(result.message) ) return sendMessage(interaction, lang.get('general.experimental')).then( message => {
					return result.message.map( async content => {
						return await interaction.followUp( {content, ephemeral} ).catch(log_error);
					} );
				} );
				/*
				if ( Array.isArray(result.message) ) return result.message.map( async (content, n) => {
					if ( n === 0 ) return await sendMessage(interaction, {content, ephemeral});
					return await interaction.followUp( {content, ephemeral} ).catch(log_error);
				} );
				*/
				if ( result.reaction === 'error' ) {
					if ( typeof result.message === 'string' ) result.message = '<:error:440871715938238494> ' + result.message;
					else result.message.content = '<:error:440871715938238494> ' + ( result.message.content ?? '' );
				}
				else if ( result.reaction === 'warning' ) {
					if ( typeof result.message === 'string' ) result.message = '⚠️ ' + result.message;
					else result.message.content = '⚠️ ' + ( result.message.content ?? '' );
				}
				if ( typeof result.message === 'string' ) result.message = lang.get('general.experimental') + '\n' + result.message;
				else result.message.content = lang.get('general.experimental') + '\n' + ( result.message.content ?? '' );
				return sendMessage(interaction, result.message);
			}
			else if ( result.reaction ) {
				let message = lang.get('interaction.error') + '\n' + process.env.invite;
				if ( result.reaction === 'nowiki' ) message = lang.get('interaction.nowiki');
				if ( result.reaction === '🤷' ) message = lang.get('search.noresult');
				return sendMessage(interaction, {content: lang.get('general.experimental') + '\n' + message});
			}
		} );
	}, log_error );
}

/**
 * Post a message with wiki links.
 * @param {import('discord.js').AutocompleteInteraction} interaction - The interaction.
 * @param {import('../util/i18n.js').default} lang - The user language.
 * @param {import('../util/wiki.js').default} wiki - The wiki for the interaction.
 */
 function autocomplete_wiki(interaction, lang, wiki) {
	lang = lang.uselang(interaction.locale);
	const title = interaction.options.getFocused();
	if ( !title.trim() ) return interaction.respond( [] ).catch(log_error);
	if ( wiki.wikifarm === 'fandom' ) return got.get( wiki + 'wikia.php?controller=UnifiedSearchSuggestions&method=getSuggestions&scope=internal&query=' + encodeURIComponent( title ) + '&format=json', {
		timeout: {
			request: 2_000
		},
		retry: {
			limit: 0
		},
		context: {
			guildId: interaction.guildId
		}
	} ).then( response => {
		var body = response.body;
		if ( body && body.warnings ) log_warning(body.warnings);
		if ( response.statusCode !== 200 || !body?.suggestions ) {
			if ( wiki.noWiki(response.url, response.statusCode) ) console.log( '- This wiki doesn\'t exist!' );
			else console.log( '- ' + response.statusCode + ': Error while getting the suggestions: ' + ( body?.error?.info || body?.message || body?.error ) );
			return;
		}
		if ( !body.suggestions.length ) return interaction.respond( [] ).catch(log_error);
		var redirects = Object.keys(body.redirects);
		return interaction.respond( body.suggestions.map( suggestion => {
			let redirect = redirects.find( redirect => body.redirects[redirect] === suggestion );
			let text = suggestion;
			if ( redirect ) text = lang.get('search.redirect', suggestion, redirect);
			return {
				name: ( text.length > 100 ? suggestion.substring(0, 100) : text ),
				value: suggestion.substring(0, 100)
			};
		} ).slice(0, 25) ).catch(log_error);
	}, error => {
		if ( wiki.noWiki(error.message) ) console.log( '- This wiki doesn\'t exist!' );
		else console.log( '- Error while getting the suggestions: ' + error );
	} );

	return got.get( wiki + 'api.php?action=opensearch&redirects=resolve&limit=10&search=' + encodeURIComponent( title ) + '&format=json', {
		timeout: {
			request: 2_000
		},
		retry: {
			limit: 0
		},
		context: {
			guildId: interaction.guildId
		}
	} ).then( response => {
		var body = response.body;
		if ( body && body.warnings ) log_warning(body.warnings);
		if ( response.statusCode !== 200 || typeof body?.[1] !== 'object' ) {
			if ( wiki.noWiki(response.url, response.statusCode) ) console.log( '- This wiki doesn\'t exist!' );
			else console.log( '- ' + response.statusCode + ': Error while getting the suggestions: ' + ( body && body.error && body.error.info ) );
			return;
		}
		if ( !body[1].length ) return interaction.respond( [] ).catch(log_error);
		return interaction.respond( body[1].map( suggestion => {
			return {
				name: suggestion.substring(0, 100),
				value: suggestion.substring(0, 100)
			};
		} ).slice(0, 25) ).catch(log_error);
	}, error => {
		if ( wiki.noWiki(error.message) ) console.log( '- This wiki doesn\'t exist!' );
		else console.log( '- Error while getting the suggestions: ' + error );
	} );
}

export default {
	name: 'wiki',
	slash: slash_wiki,
	autocomplete: autocomplete_wiki
};