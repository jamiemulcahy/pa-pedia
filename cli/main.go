package main

import (
	"os"

	"github.com/planetaryannihilation/pa-pedia/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
