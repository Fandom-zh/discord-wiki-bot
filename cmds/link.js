const check_wiki = {
	fandom: require('./wiki/fandom.js'),
	gamepedia: require('./wiki/gamepedia.js'),
	test: require('./test.js').run
};
const help_setup = require('../functions/helpsetup.js');

/**
 * Processes the wiki linking command.
 * @param {import('../util/i18n.js')} lang - The user language.
 * @param {import('discord.js').Message} msg - The Discord message.
 * @param {String} title - The page title.
 * @param {import('../util/wiki.js')} wiki - The wiki for the page.
 * @param {String} [cmd] - The command at this point.
 */
function cmd_link(lang, msg, title, wiki, cmd = '') {
	if ( msg.isAdmin() && msg.defaultSettings ) help_setup(lang, msg);
	if ( /^\|\|(?:(?!\|\|).)+\|\|$/.test(title) ) {
		title = title.substring( 2, title.length - 2);
		var spoiler = '||';
	}
	msg.reactEmoji('⏳').then( reaction => {
		if ( wiki.isFandom() ) check_wiki.fandom(lang, msg, title, wiki, cmd, reaction, spoiler);
		else check_wiki.gamepedia(lang, msg, title, wiki, cmd, reaction, spoiler);
	} );
}

module.exports = {
	name: 'LINK',
	everyone: true,
	pause: false,
	owner: true,
	run: cmd_link
};