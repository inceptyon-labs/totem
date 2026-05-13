package commands

import (
	"fmt"
	"os"

	"github.com/inceptyon-labs/totem/pkg/beancore"
	"github.com/inceptyon-labs/totem/pkg/config"
	"github.com/spf13/cobra"
)

var core *beancore.Core
var cfg *config.Config
var beansPath string
var configPath string

// NewRootCmd creates the root cobra command with shared persistent flags
// and core initialization logic.
func NewRootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "totem",
		Short: "A lightweight flat-file issue tracker",
		Long: `Totem is a lightweight issue tracker that stores issues as markdown files.
Every change is captured as a totem — a small proof of work — checked into
the repo alongside your code. Pairs naturally with audit-trail requirements.`,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			// Skip core initialization for init, prime, and version commands
			if cmd.Name() == "init" || cmd.Name() == "prime" || cmd.Name() == "version" {
				return nil
			}

			var err error

			// Load configuration
			if configPath != "" {
				cfg, err = config.Load(configPath)
				if err != nil {
					return fmt.Errorf("loading config from %s: %w", configPath, err)
				}
			} else {
				cwd, err := os.Getwd()
				if err != nil {
					return fmt.Errorf("getting current directory: %w", err)
				}
				cfg, err = config.LoadFromDirectory(cwd)
				if err != nil {
					return fmt.Errorf("loading config: %w", err)
				}
			}

			root, err := resolveBeansPath(beansPath, cfg)
			if err != nil {
				return err
			}

			core = beancore.New(root, cfg)
			if err := core.Load(); err != nil {
				return fmt.Errorf("loading totems: %w", err)
			}

			return nil
		},
	}

	rootCmd.PersistentFlags().StringVar(&beansPath, "totem-path", "", "Path to data directory (overrides config and TOTEM_PATH env var)")
	rootCmd.PersistentFlags().StringVar(&configPath, "config", "", "Path to config file (default: searches upward for .totem.yml)")

	return rootCmd
}

// resolveBeansPath determines the totem data directory path.
// Precedence: --totem-path flag > TOTEM_PATH env var > config default.
//
// In worktrees, the CLI uses the worktree's local .totem/ directory.
// totem-serve watches worktree .totem/ dirs and merges changes into
// runtime state, so the UI stays up-to-date without writing to main.
func resolveBeansPath(flagPath string, c *config.Config) (string, error) {
	explicitOverride := flagPath != "" || os.Getenv("TOTEM_PATH") != ""

	var root string
	if flagPath != "" {
		root = flagPath
	} else if envPath := os.Getenv("TOTEM_PATH"); envPath != "" {
		root = envPath
	} else {
		root = c.ResolveBeansPath()
	}

	if info, statErr := os.Stat(root); statErr != nil || !info.IsDir() {
		if explicitOverride {
			return "", fmt.Errorf("totem path does not exist or is not a directory: %s", root)
		}
		return "", fmt.Errorf("no .totem directory found at %s (run 'totem init' to create one)", root)
	}

	return root, nil
}

// Execute runs the given root command and exits on error.
func Execute(rootCmd *cobra.Command) {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
