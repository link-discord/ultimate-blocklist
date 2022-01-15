const path = require('path')
const fs = require('fs-extra')
const { stripIndents } = require('common-tags')
const { default: axios } = require('axios')

function cleanList(list) {
    // Filter out empty lines
    list = list.filter(line => line.length > 0)
    // Filter out comments that start with #
    list = list.filter(line => !line.startsWith('#'))
    // Remove all 0.0.0.0 entries
    list = list.map(line => line.replace('0.0.0.0', ''))
    // Trim whitespace at beginning and end of each line
    list = list.map(line => line.trim())
    // Remove all duplicates
    list = [...new Set(list)]
    // Return the new list
    return list
}

function generateComment(name, list) {
    // make the first character uppercase
    name = name.charAt(0).toUpperCase() + name.slice(1)

    return stripIndents`
    # -------------------------------------[INFO]---------------------------------------
    # Title: The Ultimate Blocklist - ${name}
    # Last Updated: ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })}
    # Homepage: https://github.com/link-discord/ultimate-blocklist
    # Help: https://github.com/link-discord/ultimate-blocklist/issues
    # License: https://unlicense.org
    # Total number of blocked domains: ${list.length.toLocaleString('de-DE')}
    # ------------------------------------[DOMAINS]-------------------------------------
    `
}

async function main() {
    const files = await fs.readdir(path.join(__dirname, 'urls'))

    for (const file of files) {
        const name = file.replace('.txt', '')
        const listsFile = await fs.readFile(path.join(__dirname, 'urls', file), 'utf8')
        const lists = listsFile.split('\n')

        console.log(`Going through the lists for ${name}\n`)

        let fullList = []

        for (const list of lists) {
            console.log(`Fetching ${list}`)

            const { data } = await axios.get(list)
            const cleanedList = cleanList(data.split('\n'))

            fullList = fullList.concat(cleanedList)
        }

        console.log()

        // sort the full list alphabetically
        fullList = fullList.sort()

        const comment = generateComment(name, fullList)
        const output = `${comment}\n${fullList.join('\n')}`

        await fs.outputFile(path.join(__dirname, 'lists', `${name}.txt`), output)
    }
}

main().then(() => { console.log('Finished updating all the list files') })
