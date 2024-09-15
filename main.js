const generator = async (prompts, validationRegExes, about, dir, cmd, mergeScript, removeDefault, chalk, fs) => {
    /*
        DON'T DELETE THIS COMMENT, YOU MIGHT NEED IT LATER

        This function will get run when creating boilerplate code.
        You can use the above defined methods to generate code
        Here's a brief explanation of each:

        prompts: contains various prompt functions to get input frome the use
            {
                async prompt(question, defaultValue = '', validationRegEx = null, canBeEmpty = false, validatorFunction = null) => string // NOTE: The validatorFunction can be async
                async confirm(question) => true|false
                async numeral(question, validatorFunction) => number
                async toggle(question, option1, option2) => option1|option2
                async select(question, [...choices]) => choice
                async multiSelect(question, [...choices], min = 0, max = Infinity) => [...choices]
            }
        validationRegExes: contains various RegExes that are useful when dealing with prompts. As of now:
            {
                identifier: Allows a-z, A-Z, -, _, @, ~ and .
                license: Allows valid SPDX licenses, UNKNOWN and SEE LICENSE IN <file>
                repository: Allows github repos, eg. username/repo
                email: Allows valid emails,
                confirmation: Allows yes, no, y and n
                username: Allows typically valid usernames
                url: Allows urls with optional protocol
                phone: Allows international phone numbers
            }
        about: contains whatever the user specified using nautus me. NOTE: All fields can be empty
            {
                realName,
                githubUsername,
                name,
                gender,
                email
            }
        dir: path to the directory where the project files are saved
        cmd: function that allows you to run commands jsut like in a nautus script
            async cmd(command: string) => [exitCode, stdout]
        mergeScript: function that allows you to merge code into a script. NOTE: Don't include the boilerplate for a script, jsut include what needs to be put in the function
            // scriptName shall not include @ or .js
            mergeScript(scriptName, code) => void
        removeDefault: function that removes the default error from a script
            // scriptName shall not include @ or .js
            removeDefault(scriptName) => void
        chalk: chalk module to help you style your console.log's. See https://www.npmjs.com/package/chalk for more
        fs: like the default fs module, but writeFile and writeFileSync are protected
            and ask user before overwriting existing files.
            NOTE: Usage of require('fs') is prohibited to protect the users data
    */

    const { prompt, confirm, numeral, toggle, select, multiSelect } = prompts
    const path = require('path')
    const identifier = JSON.parse(fs.readFileSync(path.join(dir, 'nautus', '.internal', 'project.json')).toString('utf8')).identifier

    // Do your prompts here
    const description = await prompt('Description', '', null, true)
    let main = await toggle('Entry point', 'main.ts', 'index.ts')
    const license = await prompt('License', 'MIT', validationRegExes.license)
    let repo = null
    if (await confirm('Do you have a GitHub repo?')) {
        repo = await prompt('Repository', `${about.githubUsername}/${identifier}`, validationRegExes.repository)
    }
    const tsTarget = (await prompt('Target', 'ESNext', /^(es|ES|Es|eS)(([0-9]|(N|n)(E|e)(X|x)(T|t))*)$/)).toLowerCase()
    const tsModule = await toggle('Module', 'NodeNext', 'commonjs')

    // Do your generation here

    // Generate package.json
    const pkgJSON = {
        name: `${identifier}`,
        version: '0.0.0',
        description,
        main: `dist/${main.replace('.ts', '.js')}`,
        scripts: {
            test: "echo \"Error: no test specified\" && exit 1"
        },
        keywords: [],
        author: `${about.name || about.githubUsername} (https://github.com/${about.githubUsername})`,
        license,
        dependencies: {},
        types: 'dist/index.d.ts'
    }

    if (repo) {
        pkgJSON.repository = {
            type: 'git',
            url: `git+https://github.com/${repo}.git`
        }
        pkgJSON.bugs = {
            url: `https://github.com/${repo}/issues`
        }
        pkgJSON.homepage = `https://github.com/${repo}#readme`
    }

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJSON, null, 4))
    fs.ensureFileSync(path.join(dir, 'README.md'))

    await cmd('npm i typescript @types/node -D')
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            target: tsTarget,
            module: tsModule,
            moduleResolution: tsModule === 'NodeNext' ? 'NodeNext' : undefined,
            declaration: true,
            outDir: './dist',
            strict: true,
        },
        include: ["src/**/*.ts"],
        exclude: ["node_modules", "**/*.spec.ts"]
    }, null, 4))
    fs.ensureDirSync(path.join(dir, 'src'))
    fs.ensureFileSync(path.join(dir, 'src', main))

    // @Build.js
    removeDefault('Build') // Removes the default error message
    mergeScript('Build', `exit(await spawn(modules.path.join(process.cwd(), 'node_modules/.bin/tsc'), []))`)

    // @Prep.js
    mergeScript('Prep', `await cmd(modules.path.join(process.cwd(), 'node_modules/.bin/tsc')).catch(error)`)

    // @Run.js
    removeDefault('Run') // Removes the default error message
    mergeScript('Run', `exit(await spawn('node', ["dist/${main.replace('.ts', '.js') }", ...process.argv.slice(3)]))`)

    fs.appendFileSync(path.join(dir, '.npmignore'), 'lib/\n.dccache\nnautus\n')

    // INFO
    console.log(chalk.green(`Successfully generated project. You can run it by using ${chalk.cyan('nautus run')}. Start by editing ${chalk.gray('./src/' + main)}`))
}

module.exports = {
    generator: generator, // This will get run if you use nautus kelp (aka want to create boilerplate in afresh project)
    use: generator, // This will get run if you use nautus use (aka want additional boilerplate or support for a framework / runtime). Make sure that this won't replace important stuff
    commands: () => {
        /*
            If you just want to create boilerplate code, this function is irrelevant for you.
            If you want to create commands anyways, use "nautus use commands"
            in this project to add command support.
        */
    },
    gitIgnore: `# If you want to merge something into the .gitignore, add it here`
}