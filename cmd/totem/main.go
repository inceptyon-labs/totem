package main

import "github.com/inceptyon-labs/totem/internal/commands"

func main() {
	root := commands.NewRootCmd()
	commands.RegisterCoreCommands(root)
	commands.Execute(root)
}
