package main

import (
	"os"

	"github.com/jamiemulcahy/pa-pedia/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
