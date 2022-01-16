const path = require('path')
const fs = require('fs-extra')
const isValidDomain = require('is-valid-domain')
const prettier = require('prettier')
const { stripIndents } = require('common-tags')
const { default: fetch } = require('got-fetch')

let markdown = fs.readFileSync('TEMPLATE.md', 'utf8')

function cleanList(list) {
    // Filter out empty lines
    list = list.filter(line => line.length > 0)
    // Filter out comments that start with #
    list = list.filter(line => !line.startsWith('#'))
    // Remove all 0.0.0.0 entries
    list = list.map(line => line.replace('0.0.0.0', ''))
    // Remove all 127.0.0.1 entries
    list = list.map(line => line.replace('127.0.0.1', ''))
    // Trim whitespace at beginning and end of each line
    list = list.map(line => line.trim())
    // Return the new list
    return list
}

function generateMarkdownList(title, list) {
    title = title.charAt(0).toUpperCase() + title.slice(1)

    markdown += '\n\n'
    markdown += stripIndents`
        ### ${title} Blocklist

        ${list.map(line => `- ${line}`).join('\n')}
    `
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
    let { cache, lastUpdate } = await fs.readJSON(path.join(__dirname, 'cache', 'cache.json'))

    // check if the last update was more than half an hour ago
    if (Date.now() - lastUpdate > 1800000) {
        await fs.writeJSON(path.join(__dirname, 'cache', 'cache.json'), {
            lastUpdate: Date.now(),
            cache: {}
        })

        cache = {}
    }

    const files = await fs.readdir(path.join(__dirname, 'urls'))

    for (const file of files) {
        const name = file.replace('.txt', '')
        const listsFile = await fs.readFile(path.join(__dirname, 'urls', file), 'utf8')
        let lists = listsFile.split('\n')

        console.log(`Sorting the ${name} list...`)

        lists = lists.sort()

        console.log('Removing duplicates...')

        lists = [...new Set(lists)]

        console.log(`Overwriting the ${file} file...`)

        await fs.outputFile(path.join(__dirname, 'urls', file), lists.join('\n'))

        generateMarkdownList(name, lists)

        console.log(`Going through the lists for ${name}\n`)

        let fullList = []

        for (const list of lists) {
            if (cache[list]) {
                console.log(`Retrieved ${list} from cache.`)
                fullList = fullList.concat(cache.get(list))
                continue
            }

            console.log(`Fetching ${list}`)

            const res = await fetch(list)
            const data = await res.text()
            const cleanedList = cleanList(data.split('\n'))

            cache[list] = cleanedList

            fullList = fullList.concat(cleanedList)
        }

        console.log()

        console.log('Sorting...')

        fullList = fullList.sort()

        console.log('Validating domains...')

        fullList = fullList.filter(line => isValidDomain(line) && !line.includes('ф'))

        console.log('Removing duplicates...')

        fullList = [...new Set(fullList)]

        fullList = fullList.map(line => `0.0.0.0 ${line}`)

        const comment = generateComment(name, fullList)
        const output = `${comment}\n${fullList.join('\n')}`

        const fullListNL = fullList.map(line => line.replace('0.0.0.0', '').trim())
        const commentNL = generateComment(`${name} (NL)`, fullListNL)
        const outputNL = `${commentNL}\n${fullListNL.join('\n')}`

        const fullListAdguard = fullList.map(line => `||${line.replace('0.0.0.0', '').trim()}^`)
        const commentAdguard = generateComment(`${name} (Adguard)`, fullListAdguard).replace(/#/g, '!')
        const outputAdguard = `${commentAdguard}\n${fullListAdguard.join('\n')}`

        console.log(`Writing to file...\n`)

        await fs.outputFile(path.join(__dirname, 'lists', `${name}.txt`), output)
        await fs.outputFile(path.join(__dirname, 'lists', `${name}-nl.txt`), outputNL)
        await fs.outputFile(path.join(__dirname, 'lists', `${name}-adguard.txt`), outputAdguard)
    }

    console.log('Writing to README...\n')

    const allLists = Object.values(cache).flat()

    markdown.replace('${entries}', allLists.length.toLocaleString('de-DE'))

    const formattedMarkdown = prettier.format(markdown, {
        parser: 'markdown',
        printWidth: 120
    })

    await fs.outputFile('README.md', formattedMarkdown)

    const obj = { lastUpdate: Date.now(), cache }

    // Save the cache
    await fs.writeJSON(path.join(__dirname, 'cache', 'cache.json'), obj)
}

main().then(() => {
    console.log('Finished updating all the list files')
})
